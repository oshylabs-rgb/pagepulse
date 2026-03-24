import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendConfirmationEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pagepulse.se'

    // Use admin client to create the user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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

        if (linkError) {
          return NextResponse.json({ error: linkError.message }, { status: 400 })
        }

        // Build the confirmation URL using our confirm route
        const confirmUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=signup&next=/dashboard`

        await sendConfirmationEmail(email, confirmUrl)

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

    if (signupError) {
      return NextResponse.json({ error: signupError.message }, { status: 400 })
    }

    // Build the confirmation URL using our confirm route
    const confirmUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=signup&next=/dashboard`

    // Send branded confirmation email via Resend
    await sendConfirmationEmail(email, confirmUrl)

    return NextResponse.json({ message: 'Account created. Check your email to confirm.' })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}
