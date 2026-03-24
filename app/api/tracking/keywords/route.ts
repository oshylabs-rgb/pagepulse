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

    const { data: keywords, error } = await supabase
      .from('keyword_signals')
      .select('*')
      .eq('site_id', siteId)
      .order('occurrences', { ascending: false })
      .limit(50)

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ keywords: [], error: error.message })
    }

    return NextResponse.json({ keywords: keywords || [] })
  } catch (error) {
    console.error('Tracking keywords error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
