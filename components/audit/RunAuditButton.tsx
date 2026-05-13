'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

// Defensive: never display raw provider JSON in a toast. If `value` looks like
// a JSON-shaped provider error, extract its `.error.message`; otherwise fall
// back to a generic message.
function extractErrorMessage(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        const nested = parsed?.error?.message ?? parsed?.message
        if (typeof nested === 'string' && nested.length > 0) {
          // Nested provider message — still cap length and strip braces.
          return nested.length > 240 ? `${nested.slice(0, 240)}…` : nested
        }
        return 'Audit failed. Please try again.'
      } catch {
        return 'Audit failed. Please try again.'
      }
    }
    return trimmed
  }
  if (value && typeof value === 'object') {
    const obj = value as { message?: unknown; error?: { message?: unknown } }
    if (typeof obj.message === 'string') return obj.message
    if (obj.error && typeof obj.error.message === 'string') return obj.error.message
  }
  return ''
}

export default function RunAuditButton({
  siteId,
  siteUrl,
}: {
  siteId: string
  siteUrl: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRunAudit() {
    setLoading(true)
    try {
      const res = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, url: siteUrl }),
      })

      let data: { error?: unknown; status?: string; overall_score?: number } = {}
      try {
        data = await res.json()
      } catch {
        // Non-JSON response (e.g. proxy timeout HTML) — leave data empty.
      }

      if (!res.ok) {
        throw new Error(extractErrorMessage(data.error) || 'Failed to run audit. Please try again.')
      }

      if (data.status === 'completed') {
        toast.success(`Audit complete — score: ${data.overall_score}/100`)
      } else if (data.status === 'failed') {
        toast.error(extractErrorMessage(data.error) || 'Audit failed. Please try again.')
      } else {
        toast.success('Audit complete.')
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRunAudit}
      disabled={loading}
      className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? 'Analysing...' : 'Run Audit'}
    </button>
  )
}
