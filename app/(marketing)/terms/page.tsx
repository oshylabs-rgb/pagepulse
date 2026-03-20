import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: March 2026</p>

      <div className="prose mt-8 text-gray-700">
        <h2>1. Service Description</h2>
        <p>
          PagePulse provides AI-powered SEO auditing and monitoring. Audits are generated using
          AI analysis and should be used as guidance, not as definitive assessments.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You are responsible for maintaining the security of your account. You must provide
          accurate information when registering.
        </p>

        <h2>3. Billing</h2>
        <p>
          Paid plans are billed monthly via Stripe. You may cancel at any time — your plan remains
          active until the end of the billing period.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>
          You may only audit websites you own or have authorisation to audit. Automated mass
          scanning of third-party sites is prohibited.
        </p>

        <h2>5. Limitation of Liability</h2>
        <p>
          PagePulse is provided &quot;as is&quot;. We are not liable for SEO outcomes, ranking changes,
          or any business decisions made based on our audit results.
        </p>

        <h2>6. Contact</h2>
        <p>Oshylabs Ltd — hello@oshylabs.com</p>
      </div>
    </main>
  )
}
