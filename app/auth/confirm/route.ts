import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  // Also handle the code-based flow (some Supabase email templates use code instead of token_hash)
  const code = searchParams.get('code')

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error) {
      // For signup confirmations, redirect to login with success message
      // (user needs to sign in after confirming their email).
      // Magic-link verifications confirm the email AND establish a session,
      // so we can drop straight into the dashboard.
      if (type === 'signup' || type === 'email') {
        return NextResponse.redirect(`${origin}/login?verified=true`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Email verification error:', error.message)
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Code exchange error:', error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
