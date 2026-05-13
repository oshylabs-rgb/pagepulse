import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  sendConfirmationEmail,
  EmailConfigError,
  EmailProviderRestrictedError,
} from '@/lib/email'

// Public user-facing message for the "Resend is still in test mode" situation.
// We do NOT echo Resend's raw error (which mentions a private admin email).
const EMAIL_NOT_READY_MESSAGE =
  'We can\'t send confirmation emails right now. Our team has been notified — please try again shortly or contact support@pagepulse.se.'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Signup misconfigured: Supabase env vars missing')
      return NextResponse.json(
        { error: 'Signup is temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pagepulse.se'

    // Use admin client to create the user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // If user exists but not confirmed, resend confirmation
      if (!existingUser.email_confirmed_at) {
        // Generate a new confirmation link
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email,
          password,
          options: {
            redirectTo: `${appUrl}/dashboard`,
          },
        })

        if (linkError || !linkData?.properties?.hashed_token) {
          return NextResponse.json(
            { error: linkError?.message || 'Could not generate confirmation link' },
            { status: 400 }
          )
        }

        // Build the confirmation URL using our confirm route
        const confirmUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=signup&next=/dashboard`

        try {
          await sendConfirmationEmail(email, confirmUrl)
        } catch (emailErr) {
          return handleEmailError(emailErr)
        }

        return NextResponse.json({ message: 'Confirmation email resent' })
      }

      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 })
    }

    // Create new user (without auto-confirm — we'll send our own email)
    const { data: linkData, error: signupError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${appUrl}/dashboard`,
      },
    })

    if (signupError || !linkData?.properties?.hashed_token) {
      return NextResponse.json(
        { error: signupError?.message || 'Could not create account' },
        { status: 400 }
      )
    }

    // Build the confirmation URL using our confirm route
    const confirmUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=signup&next=/dashboard`

    // Send branded confirmation email via Resend. If this fails we must
    // delete the just-created user so they can retry signup cleanly instead
    // of being locked out by "an account already exists" on the next attempt.
    try {
      await sendConfirmationEmail(email, confirmUrl)
    } catch (emailErr) {
      const createdUserId = linkData.user?.id
      if (createdUserId) {
        await supabaseAdmin.auth.admin
          .deleteUser(createdUserId)
          .catch((e) => console.error('Failed to roll back signup user:', e))
      }
      return handleEmailError(emailErr)
    }

    return NextResponse.json({ message: 'Account created. Check your email to confirm.' })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}

function handleEmailError(emailErr: unknown) {
  if (emailErr instanceof EmailProviderRestrictedError) {
    // Resend is still in test mode (sender domain not verified). Log loudly
    // for the operator, but never leak the admin's email back to the user.
    console.error(
      '[signup] Resend sender not verified — confirmation email blocked. ' +
        'Verify a domain at resend.com/domains and set EMAIL_FROM to a verified address.'
    )
    return NextResponse.json({ error: EMAIL_NOT_READY_MESSAGE }, { status: 503 })
  }
  if (emailErr instanceof EmailConfigError) {
    console.error('[signup] Email provider misconfigured:', emailErr.message)
    return NextResponse.json({ error: EMAIL_NOT_READY_MESSAGE }, { status: 503 })
  }
  console.error('[signup] Email send failed:', emailErr)
  const msg = emailErr instanceof Error ? emailErr.message : 'Could not send confirmation email'
  return NextResponse.json({ error: msg }, { status: 502 })
}
