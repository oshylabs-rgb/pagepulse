import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  sendConfirmationEmail,
  EmailConfigError,
  EmailProviderRestrictedError,
} from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Resend confirmation misconfigured: Supabase env vars missing')
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pagepulse.se'

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Find the user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const user = existingUsers?.users?.find((u) => u.email === email)

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({ message: 'If an account exists, a confirmation email has been sent.' })
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ message: 'Email already confirmed. You can sign in.' })
    }

    // Generate a new confirmation link. We do NOT pass a password — the
    // account already exists and Supabase will reject signup-link generation
    // with an empty password (it tries to update the user's password to "").
    // Using magiclink for unconfirmed users still confirms the email on use.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${appUrl}/dashboard`,
      },
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('Generate link error:', linkError)
      return NextResponse.json({ message: 'If an account exists, a confirmation email has been sent.' })
    }

    const confirmUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/dashboard`

    try {
      await sendConfirmationEmail(email, confirmUrl)
    } catch (emailErr) {
      if (emailErr instanceof EmailProviderRestrictedError) {
        console.error(
          '[resend-confirmation] Resend sender not verified — email blocked. ' +
            'Verify a domain at resend.com/domains and set EMAIL_FROM.'
        )
        return NextResponse.json(
          {
            error:
              "We can't send confirmation emails right now. Please contact support@pagepulse.se.",
          },
          { status: 503 }
        )
      }
      if (emailErr instanceof EmailConfigError) {
        return NextResponse.json(
          { error: 'Email service not configured. Please contact support.' },
          { status: 503 }
        )
      }
      console.error('Resend confirmation email error:', emailErr)
      return NextResponse.json({ error: 'Failed to resend confirmation' }, { status: 502 })
    }

    return NextResponse.json({ message: 'Confirmation email sent. Check your inbox.' })
  } catch (error) {
    console.error('Resend confirmation error:', error)
    return NextResponse.json({ error: 'Failed to resend confirmation' }, { status: 500 })
  }
}
