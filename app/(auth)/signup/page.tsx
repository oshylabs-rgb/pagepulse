'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  async function handleResend() {
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      toast.success(data.message || 'Confirmation email sent')
    } catch {
      toast.error('Failed to resend. Try again in a moment.')
    }
    setResending(false)
  }

  if (success) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
          <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="mt-4 text-gray-600">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Click it to activate your account.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Can&apos;t find it? Check your spam folder.
        </p>
        <button
          onClick={handleResend}
          disabled={resending}
          className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
        >
          {resending ? 'Sending...' : 'Resend confirmation email'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-2 text-sm text-gray-500">
        Start auditing your site for free — no credit card required.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-400">Minimum 8 characters</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
