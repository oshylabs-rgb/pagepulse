import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: March 2026</p>

      <div className="prose mt-8 text-gray-700">
        <h2>1. Information We Collect</h2>
        <p>
          When you create an account, we collect your email address. When you add sites for auditing,
          we store the URLs you provide and the audit results we generate.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use your data to provide SEO audit services, send audit reports, and process payments.
          We do not sell your data to third parties.
        </p>

        <h2>3. Data Storage</h2>
        <p>
          Your data is stored securely on Supabase (hosted on AWS). Payment processing is handled
          by Stripe, who store your payment details under their own privacy policy.
        </p>

        <h2>4. Your Rights</h2>
        <p>
          Under GDPR you can request access to, correction of, or deletion of your personal data.
          Contact us at hello@oshylabs.com.
        </p>

        <h2>5. Contact</h2>
        <p>PagePulse is operated by Oshylabs Ltd. Email: hello@oshylabs.com</p>
      </div>
    </main>
  )
}
