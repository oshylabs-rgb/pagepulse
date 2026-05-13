import { createClient } from '@/lib/supabase/server'
import { analyseSEO, GeminiError, GeminiPermissionDeniedError, type SEOAnalysis } from '@/lib/gemini'
import { generateFallbackAnalysis } from '@/lib/fallback-analysis'
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Allow up to 60 seconds for audit to complete (Gemini can take a while)
export const maxDuration = 60

// When true (default), audits succeed with a deterministic technical report
// even if the AI provider is unavailable (quota exceeded, permission denied,
// missing model, timeout, etc.). Set AI_REPORTS_OPTIONAL=false to force a
// hard failure on provider errors instead.
function aiReportsOptional(): boolean {
  const v = (process.env.AI_REPORTS_OPTIONAL ?? 'true').toLowerCase()
  return v !== 'false' && v !== '0' && v !== 'no'
}

function isRecoverableAiError(err: unknown): boolean {
  if (err instanceof GeminiError || err instanceof GeminiPermissionDeniedError) return true
  if (err instanceof Error) {
    const msg = err.message || ''
    // Missing key / SDK config — also treat as recoverable so the user still
    // gets a report instead of a hard 500.
    if (/GEMINI_API_KEY|gemini api/i.test(msg)) return true
    if (err.name === 'AbortError' || /timeout/i.test(msg)) return true
  }
  return false
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { site_id, url } = await request.json()

    if (!site_id || !url) {
      return NextResponse.json({ error: 'site_id and url are required' }, { status: 400 })
    }

    // Verify site ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', site_id)
      .eq('user_id', user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Create audit record
    const { data: audit, error: insertError } = await supabase
      .from('audits')
      .insert({
        site_id,
        user_id: user.id,
        status: 'running',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Run the audit synchronously — Vercel serverless functions terminate
    // after the response is sent, so we must complete the work first.
    let html = ''
    let headers: Record<string, string> = {}
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'PagePulse SEO Auditor/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout for page fetch
      })

      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch page: ${pageResponse.status} ${pageResponse.statusText}`)
      }

      html = await pageResponse.text()
      pageResponse.headers.forEach((value, key) => {
        headers[key] = value
      })
    } catch (fetchErr) {
      console.error('Audit fetch error:', fetchErr)
      const friendly =
        fetchErr instanceof Error && /timeout/i.test(fetchErr.message)
          ? 'Could not load the target page (timed out after 15s).'
          : 'Could not load the target page. Check that the URL is reachable.'

      const failureUpdate: Record<string, unknown> = {
        status: 'failed',
        completed_at: new Date().toISOString(),
      }
      const { error: failUpdateError } = await supabase
        .from('audits')
        .update({ ...failureUpdate, error_message: friendly })
        .eq('id', audit.id)
      if (failUpdateError && failUpdateError.message?.includes('column')) {
        await supabase.from('audits').update(failureUpdate).eq('id', audit.id)
      }

      return NextResponse.json(
        { audit_id: audit.id, status: 'failed', error: friendly },
        { status: 502 }
      )
    }

    // Analyse: try Gemini first; on recoverable provider error (and when
    // AI_REPORTS_OPTIONAL is on, the default), fall back to a deterministic
    // technical analysis so users still get a useful report.
    let analysis: SEOAnalysis
    let aiSummaryStatus: 'ai' | 'fallback' = 'ai'
    let aiErrorForLog: Error | null = null

    try {
      analysis = await analyseSEO(url, html, headers)
    } catch (analysisError) {
      if (aiReportsOptional() && isRecoverableAiError(analysisError)) {
        aiErrorForLog = analysisError instanceof Error ? analysisError : new Error(String(analysisError))
        console.warn('AI analysis unavailable, using deterministic fallback:', aiErrorForLog.message)
        analysis = generateFallbackAnalysis(url, html, headers)
        aiSummaryStatus = 'fallback'
      } else {
        console.error('Audit analysis error:', analysisError)
        const friendlyMessage =
          analysisError instanceof GeminiPermissionDeniedError ||
          analysisError instanceof GeminiError
            ? analysisError.message
            : 'Audit failed during analysis. Please try again.'

        const failureUpdate: Record<string, unknown> = {
          status: 'failed',
          completed_at: new Date().toISOString(),
        }
        const { error: failUpdateError } = await supabase
          .from('audits')
          .update({ ...failureUpdate, error_message: friendlyMessage })
          .eq('id', audit.id)
        if (failUpdateError && failUpdateError.message?.includes('column')) {
          await supabase.from('audits').update(failureUpdate).eq('id', audit.id)
        }

        const httpStatus =
          analysisError instanceof GeminiPermissionDeniedError
            ? 502
            : analysisError instanceof GeminiError
              ? analysisError.status >= 400 && analysisError.status < 600
                ? analysisError.status === 403
                  ? 502
                  : analysisError.status
                : 502
              : 500

        return NextResponse.json(
          { audit_id: audit.id, status: 'failed', error: friendlyMessage },
          { status: httpStatus }
        )
      }
    }

    // Persist the completed audit. We try the richest column set first and
    // progressively drop optional columns if the schema is older.
    const completedAt = new Date().toISOString()
    const baseUpdate: Record<string, unknown> = {
      status: 'completed',
      overall_score: analysis.overall_score,
      performance_score: analysis.performance_score,
      seo_score: analysis.seo_score,
      accessibility_score: analysis.accessibility_score,
      best_practices_score: analysis.best_practices_score,
      issues: analysis.issues,
      recommendations: analysis.recommendations,
      completed_at: completedAt,
    }

    // Try full update with the optional columns; on a missing-column error,
    // peel them back. We never let a schema mismatch fail the audit.
    type UpdateAttempt = { fields: Record<string, unknown>; label: string }
    const attempts: UpdateAttempt[] = [
      {
        label: 'full',
        fields: {
          ...baseUpdate,
          keywords_detected: analysis.keywords_detected || [],
          signals: analysis.signals || [],
          ai_summary_status: aiSummaryStatus,
          error_message: null,
        },
      },
      {
        label: 'no ai_summary_status',
        fields: {
          ...baseUpdate,
          keywords_detected: analysis.keywords_detected || [],
          signals: analysis.signals || [],
          error_message: null,
        },
      },
      {
        label: 'no keywords/signals',
        fields: { ...baseUpdate, error_message: null },
      },
      { label: 'minimal', fields: baseUpdate },
    ]

    let updateSucceeded = false
    for (const attempt of attempts) {
      const { error } = await supabase.from('audits').update(attempt.fields).eq('id', audit.id)
      if (!error) {
        updateSucceeded = true
        break
      }
      if (!error.message?.toLowerCase().includes('column')) {
        console.error('Audit update failed:', error)
        break
      }
      console.warn(`Audit update fell back (${attempt.label}):`, error.message)
    }

    if (!updateSucceeded) {
      // As a last resort, force the minimal update so we never leave a
      // 'running' row behind.
      await supabase.from('audits').update(baseUpdate).eq('id', audit.id)
    }

    // Save tracking data using service role (bypasses RLS).
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
      await serviceSupabase.from('score_history').insert({
        site_id,
        user_id: user.id,
        audit_id: audit.id,
        overall_score: analysis.overall_score,
        seo_score: analysis.seo_score,
        performance_score: analysis.performance_score,
        accessibility_score: analysis.accessibility_score,
        best_practices_score: analysis.best_practices_score,
      })
    } catch (e) {
      console.warn('Could not save score history (table may not exist yet):', e)
    }

    if (analysis.keywords_detected && analysis.keywords_detected.length > 0) {
      try {
        for (const keyword of analysis.keywords_detected.slice(0, 30)) {
          const kw = keyword.toLowerCase().trim()
          const { data: existing } = await serviceSupabase
            .from('keyword_signals')
            .select('id, occurrences')
            .eq('site_id', site_id)
            .eq('keyword', kw)
            .maybeSingle()

          if (existing) {
            await serviceSupabase
              .from('keyword_signals')
              .update({
                occurrences: (existing.occurrences || 1) + 1,
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          } else {
            await serviceSupabase.from('keyword_signals').insert({
              site_id,
              user_id: user.id,
              keyword: kw,
              source: 'audit',
              category: 'organic',
              occurrences: 1,
            })
          }
        }
      } catch (e) {
        console.warn('Could not save keyword signals:', e)
      }
    }

    if (analysis.signals && analysis.signals.length > 0) {
      try {
        const signalRows = analysis.signals.map((signal) => ({
          site_id,
          user_id: user.id,
          audit_id: audit.id,
          signal_type: signal.signal_type,
          signal_value: signal.signal_value.substring(0, 500),
          status: signal.status,
          context: signal.context,
        }))
        await serviceSupabase.from('page_signals').insert(signalRows)
      } catch (e) {
        console.warn('Could not save page signals:', e)
      }
    }

    return NextResponse.json({
      audit_id: audit.id,
      status: 'completed',
      overall_score: analysis.overall_score,
      ai_summary_status: aiSummaryStatus,
    })
  } catch (error) {
    console.error('Audit run error:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    )
  }
}
