import { createClient } from '@/lib/supabase/server'
import { analyseSEO } from '@/lib/gemini'
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Allow up to 60 seconds for audit to complete (Gemini can take a while)
export const maxDuration = 60

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

    // Check plan limits
    const { count: auditCount } = await supabase
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(new Date().setDate(1)).toISOString())

    // TODO: Check against user's plan limits

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
    // after the response is sent, so we must complete the work first
    try {
      // Fetch the webpage
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

      const html = await pageResponse.text()
      const headers: Record<string, string> = {}
      pageResponse.headers.forEach((value, key) => {
        headers[key] = value
      })

      // Analyse with Gemini (now returns code fixes, keywords, and signals)
      const analysis = await analyseSEO(url, html, headers)

      // Update the audit record with results (including new fields)
      await supabase
        .from('audits')
        .update({
          status: 'completed',
          overall_score: analysis.overall_score,
          performance_score: analysis.performance_score,
          seo_score: analysis.seo_score,
          accessibility_score: analysis.accessibility_score,
          best_practices_score: analysis.best_practices_score,
          issues: analysis.issues,
          recommendations: analysis.recommendations,
          keywords_detected: analysis.keywords_detected || [],
          signals: analysis.signals || [],
          completed_at: new Date().toISOString(),
        })
        .eq('id', audit.id)

      // Save tracking data using service role (bypasses RLS)
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Save score history
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

      // Save keyword signals (upsert — increment occurrences if keyword already exists)
      if (analysis.keywords_detected && analysis.keywords_detected.length > 0) {
        try {
          for (const keyword of analysis.keywords_detected.slice(0, 30)) {
            const kw = keyword.toLowerCase().trim()
            // Check if keyword already exists for this site
            const { data: existing } = await serviceSupabase
              .from('keyword_signals')
              .select('id, occurrences')
              .eq('site_id', site_id)
              .eq('keyword', kw)
              .single()

            if (existing) {
              // Update: increment occurrences and update last_seen
              await serviceSupabase
                .from('keyword_signals')
                .update({
                  occurrences: (existing.occurrences || 1) + 1,
                  last_seen_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
            } else {
              // Insert new keyword
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

      // Save page signals
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
      })
    } catch (analysisError) {
      console.error('Audit analysis error:', analysisError)
      await supabase
        .from('audits')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', audit.id)

      return NextResponse.json({
        audit_id: audit.id,
        status: 'failed',
        error: analysisError instanceof Error ? analysisError.message : 'Analysis failed',
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Audit run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
