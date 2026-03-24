'use client'

import { useEffect, useState } from 'react'

interface Signal {
  signal_type: string
  signal_value: string
  status: string
  context: string
}

export default function SignalOverview({ siteId }: { siteId: string }) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tracking/signals?site_id=${siteId}`)
      .then((res) => res.json())
      .then((data) => {
        setSignals(data.signals || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [siteId])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">SEO Signals</h3>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="animate-pulse text-sm text-gray-400">Loading signal data...</p>
        </div>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">SEO Signals</h3>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-gray-400">
            Run an audit to see your page&apos;s SEO signals.
          </p>
        </div>
      </div>
    )
  }

  // Deduplicate by signal_type (keep latest)
  const uniqueSignals = signals.reduce((acc, signal) => {
    if (!acc.has(signal.signal_type)) {
      acc.set(signal.signal_type, signal)
    }
    return acc
  }, new Map<string, Signal>())

  const signalList = Array.from(uniqueSignals.values())

  const goodSignals = signalList.filter((s) => s.status === 'good')
  const needsWork = signalList.filter((s) => s.status === 'needs_improvement')
  const missing = signalList.filter((s) => s.status === 'missing')

  const statusIcon = (status: string) => {
    if (status === 'good') return '✓'
    if (status === 'needs_improvement') return '!'
    return '✕'
  }

  const statusColor = (status: string) => {
    if (status === 'good') return 'bg-green-50 border-green-200 text-green-700'
    if (status === 'needs_improvement') return 'bg-yellow-50 border-yellow-200 text-yellow-700'
    return 'bg-red-50 border-red-200 text-red-700'
  }

  const formatType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SEO Signals</h3>
          <p className="mt-1 text-sm text-gray-500">
            <span className="text-green-600">{goodSignals.length} good</span>
            {' · '}
            <span className="text-yellow-600">{needsWork.length} need work</span>
            {' · '}
            <span className="text-red-600">{missing.length} missing</span>
          </p>
        </div>
      </div>

      {/* Signal grid */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[...missing, ...needsWork, ...goodSignals].map((signal, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-3 ${statusColor(signal.status)}`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-sm font-bold">{statusIcon(signal.status)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{formatType(signal.signal_type)}</p>
                <p className="mt-0.5 truncate text-xs opacity-80">{signal.signal_value}</p>
                {signal.context && (
                  <p className="mt-1 text-xs opacity-70">{signal.context}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
