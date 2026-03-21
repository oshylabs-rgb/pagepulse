'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

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

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run audit')
      }

      if (data.status === 'completed') {
        toast.success(`Audit complete — score: ${data.overall_score}/100`)
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
