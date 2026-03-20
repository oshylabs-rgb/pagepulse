import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Know Your SEO Score
            <br />
            <span className="text-indigo-200">Before Google Does</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-indigo-100">
            PagePulse uses AI to audit your website, track SEO health over time,
            and deliver actionable recommendations — so you can focus on growing
            your business.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-white px-8 py-3 font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
            >
              Start Free Audit
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-indigo-300 px-8 py-3 font-semibold text-white transition hover:bg-indigo-600"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-bold">
          Everything You Need to Rank Higher
        </h2>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'AI-Powered Audits',
              description:
                'Get a comprehensive SEO audit powered by AI. Analyse meta tags, headings, images, performance, accessibility, and more.',
              icon: '🔍',
            },
            {
              title: 'Score Tracking',
              description:
                'Monitor your SEO scores over time. See trends, catch regressions early, and measure the impact of your improvements.',
              icon: '📈',
            },
            {
              title: 'Smart Alerts',
              description:
                'Get notified when your scores drop, SSL certificates near expiry, or critical issues are detected on your site.',
              icon: '🔔',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-gray-100 bg-gray-50 p-8"
            >
              <span className="text-4xl">{feature.icon}</span>
              <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-gray-50 px-6 py-24 text-center">
        <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
        <p className="mt-4 text-gray-600">
          Start free. Upgrade when you need more.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {[
            { plan: 'Free', price: '£0', features: '1 site · 3 audits/mo' },
            { plan: 'Pro', price: '£9/mo', features: '5 sites · 50 audits/mo · Monitoring' },
            { plan: 'Agency', price: '£29/mo', features: '25 sites · 500 audits/mo · Monitoring' },
          ].map((tier) => (
            <div
              key={tier.plan}
              className="w-64 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{tier.plan}</h3>
              <p className="mt-2 text-3xl font-bold">{tier.price}</p>
              <p className="mt-2 text-sm text-gray-500">{tier.features}</p>
            </div>
          ))}
        </div>
        <Link
          href="/pricing"
          className="mt-8 inline-block text-indigo-600 underline hover:text-indigo-800"
        >
          Compare all features →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-12 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} PagePulse by Oshylabs Ltd. All rights reserved.</p>
        <div className="mt-4 flex items-center justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          <Link href="/cookies" className="hover:text-gray-700">Cookies</Link>
        </div>
      </footer>
    </main>
  )
}
