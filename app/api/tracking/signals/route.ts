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

    // Get the latest audit's signals, or fall back to audit data
    const { data: signals, error } = await supabase
      .from('page_signals')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      // Table might not exist yet — pull from latest audit
      const { data: latestAudit } = await supabase
        .from('audits')
        .select('signals')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return NextResponse.json({
        signals: latestAudit?.signals || [],
        source: 'audit',
      })
    }

    return NextResponse.json({ signals: signals || [], source: 'page_signals' })
  } catch (error) {
    console.error('Tracking signals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
