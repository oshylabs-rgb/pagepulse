import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new EmailConfigError(
        'RESEND_API_KEY is not configured. Set it in your environment to enable email sending.'
      )
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// Resend's shared sandbox address. When this is the from-address, the Resend
// API will only deliver to the account owner's verified email — every other
// recipient gets a 403 with a "testing emails" message. We use this as a last
// resort fallback so the app never crashes for missing config, but the signup
// API treats this state as "email provider not production-ready" and returns
// a clear operational error rather than a half-broken user record.
export const RESEND_SANDBOX_FROM = 'PagePulse <onboarding@resend.dev>'

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailConfigError'
  }
}

export class EmailProviderRestrictedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailProviderRestrictedError'
  }
}

function getFromEmail() {
  // Prefer the operator-configured sender. Falls back to Resend's shared
  // sandbox domain so dev/test envs work out of the box. Production must set
  // EMAIL_FROM to a verified domain (e.g. "PagePulse <noreply@pagepulse.se>").
  return process.env.EMAIL_FROM || RESEND_SANDBOX_FROM
}

export function isEmailProductionReady() {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM)
}

function looksLikeResendRestriction(message: string | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('you can only send testing emails') ||
    m.includes('verify a domain') ||
    m.includes('testing emails to your own email')
  )
}

function confirmationEmailHtml(confirmUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:12px 24px;border-radius:12px;">
      <span style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">PagePulse</span>
    </div>
  </div>
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 12px;text-align:center;">Confirm your email</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center;">
      Thanks for signing up. Click the button below to verify your email and start auditing your site.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;">Verify Email Address</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;margin:24px 0 0;">
      If you didn&rsquo;t create a PagePulse account, you can safely ignore this email.
    </p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
    PagePulse &mdash; AI-Powered SEO Audits<br />
    <a href="https://www.pagepulse.se" style="color:#6366f1;">www.pagepulse.se</a>
  </p>
</div>
</body>
</html>`
}

function resetPasswordEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:12px 24px;border-radius:12px;">
      <span style="color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px;">PagePulse</span>
    </div>
  </div>
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 12px;text-align:center;">Reset your password</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center;">
      We received a request to reset your password. Click the button below to choose a new one.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;">Reset Password</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;margin:24px 0 0;">
      If you didn&rsquo;t request this, you can safely ignore this email.
    </p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
    PagePulse &mdash; AI-Powered SEO Audits<br />
    <a href="https://www.pagepulse.se" style="color:#6366f1;">www.pagepulse.se</a>
  </p>
</div>
</body>
</html>`
}

export async function sendConfirmationEmail(email: string, confirmUrl: string) {
  const { data, error } = await getResend().emails.send({
    from: getFromEmail(),
    to: [email],
    subject: 'Welcome to PagePulse — Confirm Your Email',
    html: confirmationEmailHtml(confirmUrl),
  })

  if (error) {
    console.error('Failed to send confirmation email:', error)
    if (looksLikeResendRestriction(error.message)) {
      throw new EmailProviderRestrictedError(error.message)
    }
    throw new Error(`Email send failed: ${error.message}`)
  }

  return data
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const { data, error } = await getResend().emails.send({
    from: getFromEmail(),
    to: [email],
    subject: 'Reset Your PagePulse Password',
    html: resetPasswordEmailHtml(resetUrl),
  })

  if (error) {
    console.error('Failed to send reset email:', error)
    if (looksLikeResendRestriction(error.message)) {
      throw new EmailProviderRestrictedError(error.message)
    }
    throw new Error(`Email send failed: ${error.message}`)
  }

  return data
}
