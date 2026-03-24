import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('site_id')

    if (!siteId) {
      return NextResponse.json({ error: 'site_id is required' }, { status: 400 })
    }

    // Verify site ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    const { data: scores, error } = await supabase
      .from('score_history')
      .select('*')
      .eq('site_id', siteId)
      .order('recorded_at', { ascending: true })
      .limit(50)

    if (error) {
      // Table might not exist yet — fall back to audits table
      const { data: audits } = await supabase
        .from('audits')
        .select('id, overall_score, seo_score, performance_score, accessibility_score, best_practices_score, created_at')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(50)

      const fallbackScores = (audits || []).map((a) => ({
        id: a.id,
        site_id: siteId,
        audit_id: a.id,
        overall_score: a.overall_score,
        seo_score: a.seo_score,
        performance_score: a.performance_score,
        accessibility_score: a.accessibility_score,
        best_practices_score: a.best_practices_score,
        recorded_at: a.created_at,
      }))

      return NextResponse.json({ scores: fallbackScores, source: 'audits' })
    }

    // If score_history is empty, fall back to audits
    if (!scores || scores.length === 0) {
      const { data: audits } = await supabase
        .from('audits')
        .select('id, overall_score, seo_score, performance_score, accessibility_score, best_practices_score, created_at')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(50)

      const fallbackScores = (audits || []).map((a) => ({
        id: a.id,
        site_id: siteId,
        audit_id: a.id,
        overall_score: a.overall_score,
        seo_score: a.seo_score,
        performance_score: a.performance_score,
        accessibility_score: a.accessibility_score,
        best_practices_score: a.best_practices_score,
        recorded_at: a.created_at,
      }))

      return NextResponse.json({ scores: fallbackScores, source: 'audits' })
    }

    return NextResponse.json({ scores, source: 'score_history' })
  } catch (error) {
    console.error('Tracking scores error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
