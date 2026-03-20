'use client'

import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'

const plans = [
  {
    name: 'Free',
    price: '£0',
    period: 'forever',
    features: [
      '1 website',
      '3 audits per month',
      'Basic SEO scoring',
      'Issue detection',
    ],
    cta: 'Get Started',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '£9',
    period: '/month',
    features: [
      '5 websites',
      '50 audits per month',
      'Full AI analysis',
      'Score tracking over time',
      'Smart monitoring alerts',
      'Email notifications',
    ],
    cta: 'Start Pro',
    plan: 'pro',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '£29',
    period: '/month',
    features: [
      '25 websites',
      '500 audits per month',
      'Everything in Pro',
      'Priority support',
      'White-label reports (coming soon)',
      'Team access (coming soon)',
    ],
    cta: 'Start Agency',
    plan: 'agency',
    highlight: false,
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(plan: string) {
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Failed to start checkout')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold">Simple, Transparent Pricing</h1>
        <p className="mt-4 text-lg text-gray-600">
          Start free. Scale as you grow. No hidden fees.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-8 ${
                plan.highlight
                  ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </p>
              <ul className="mt-8 space-y-3 text-left text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.href ? (
                <Link
                  href={plan.href}
                  className="mt-8 block w-full rounded-lg bg-gray-900 py-3 text-center font-semibold text-white transition hover:bg-gray-800"
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.plan!)}
                  disabled={loading === plan.plan}
                  className={`mt-8 w-full rounded-lg py-3 font-semibold text-white transition disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  {loading === plan.plan ? 'Redirecting...' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-gray-200 px-6 py-12 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} PagePulse by Oshylabs Ltd.</p>
        <div className="mt-4 flex items-center justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
        </div>
      </footer>
    </main>
  )
}
