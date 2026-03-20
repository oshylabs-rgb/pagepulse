import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendAuditCompleteEmail(
  to: string,
  siteName: string,
  overallScore: number,
  auditUrl: string
) {
  await resend.emails.send({
    from: 'PagePulse <noreply@pagepulse.io>',
    to,
    subject: `Audit Complete: ${siteName} scored ${overallScore}/100`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Your SEO Audit is Ready</h1>
        <p>The audit for <strong>${siteName}</strong> has been completed.</p>
        <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <p style="font-size: 48px; font-weight: bold; color: ${overallScore >= 80 ? '#22c55e' : overallScore >= 50 ? '#eab308' : '#ef4444'}; margin: 0;">
            ${overallScore}
          </p>
          <p style="color: #666; margin: 8px 0 0 0;">Overall Score</p>
        </div>
        <a href="${auditUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Full Report
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          PagePulse — AI-Powered SEO Auditing
        </p>
      </div>
    `,
  })
}

export async function sendAlertEmail(
  to: string,
  siteName: string,
  alertType: string,
  message: string
) {
  await resend.emails.send({
    from: 'PagePulse Alerts <alerts@pagepulse.io>',
    to,
    subject: `⚠️ Alert: ${siteName} — ${alertType}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Monitoring Alert</h1>
        <p><strong>Site:</strong> ${siteName}</p>
        <p><strong>Alert:</strong> ${alertType}</p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;">${message}</p>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">
          PagePulse — AI-Powered SEO Monitoring
        </p>
      </div>
    `,
  })
}
