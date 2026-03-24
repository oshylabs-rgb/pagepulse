import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendConfirmationEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pagepulse.se'

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const user = existingUsers?.users?.find(u => u.email === email)

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({ message: 'If an account exists, a confirmation email has been sent.' })
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ message: 'Email already confirmed. You can sign in.' })
    }

    // Generate a new confirmation link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password: '', // empty — we're just regenerating the link for existing user
      options: {
        redirectTo: `${appUrl}/dashboard`,
      },
    })

    if (linkError) {
      console.error('Generate link error:', linkError)
      return NextResponse.json({ message: 'If an account exists, a confirmation email has been sent.' })
    }

    const confirmUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=signup&next=/dashboard`
    await sendConfirmationEmail(email, confirmUrl)

    return NextResponse.json({ message: 'Confirmation email sent. Check your inbox.' })
  } catch (error) {
    console.error('Resend confirmation error:', error)
    return NextResponse.json({ error: 'Failed to resend confirmation' }, { status: 500 })
  }
}
