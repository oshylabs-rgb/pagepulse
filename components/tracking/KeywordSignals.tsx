'use client'

import { useEffect, useState } from 'react'

interface Keyword {
  id: string
  keyword: string
  source: string
  category: string
  occurrences: number
  first_seen_at: string
  last_seen_at: string
  trend: string
}

export default function KeywordSignals({ siteId }: { siteId: string }) {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'rising' | 'stable' | 'new'>('all')

  useEffect(() => {
    fetch(`/api/tracking/keywords?site_id=${siteId}`)
      .then((res) => res.json())
      .then((data) => {
        setKeywords(data.keywords || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [siteId])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">Keyword Signals</h3>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="animate-pulse text-sm text-gray-400">Loading keyword data...</p>
        </div>
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">Keyword Signals</h3>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-gray-400">
            Run audits to discover which keywords your site targets.
          </p>
        </div>
      </div>
    )
  }

  const filtered = keywords.filter((k) => {
    if (filter === 'all') return true
    if (filter === 'rising') return k.occurrences > 1
    if (filter === 'new') return k.occurrences === 1
    return k.trend === filter
  })

  const trendIcon = (kw: Keyword) => {
    if (kw.occurrences > 2) return '🔥'
    if (kw.occurrences > 1) return '↗'
    return '•'
  }

  const trendColor = (kw: Keyword) => {
    if (kw.occurrences > 2) return 'text-orange-600'
    if (kw.occurrences > 1) return 'text-green-600'
    return 'text-gray-400'
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Keyword Signals</h3>
          <p className="mt-1 text-sm text-gray-500">
            {keywords.length} keyword{keywords.length !== 1 ? 's' : ''} detected across audits
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex gap-2">
        {(['all', 'rising', 'new'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'rising' ? 'Recurring' : 'New'}
          </button>
        ))}
      </div>

      {/* Keywords list */}
      <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
        {filtered.map((kw) => (
          <div
            key={kw.id}
            className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className={`text-base ${trendColor(kw)}`}>{trendIcon(kw)}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{kw.keyword}</p>
                <p className="text-xs text-gray-400">
                  First seen {new Date(kw.first_seen_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {kw.occurrences > 1 && ` · ${kw.occurrences} audits`}
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                kw.category === 'organic'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {kw.source}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">No keywords match this filter.</p>
        )}
      </div>
    </div>
  )
}
