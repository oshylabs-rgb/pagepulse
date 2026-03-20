import { createClient } from '@/lib/supabase/server'
import { analyseSEO } from '@/lib/claude'
import { NextResponse } from 'next/server'

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

    // Run the audit in the background (fire and forget)
    runAuditAsync(audit.id, url, supabase)

    return NextResponse.json({
      audit_id: audit.id,
      status: 'running',
    })
  } catch (error) {
    console.error('Audit run error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function runAuditAsync(auditId: string, url: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PagePulse SEO Auditor/1.0',
      },
    })

    const html = await response.text()
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Analyse with Claude
    const analysis = await analyseSEO(url, html, headers)

    // Update the audit record
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
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  } catch (error) {
    console.error('Audit analysis error:', error)
    await supabase
      .from('audits')
      .update({ status: 'failed' })
      .eq('id', auditId)
  }
}
