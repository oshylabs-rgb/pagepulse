'use client'

import { useEffect, useState } from 'react'

interface ScorePoint {
  recorded_at: string
  overall_score: number | null
  seo_score: number | null
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
}

const COLORS = {
  overall: '#6366f1',
  seo: '#3b82f6',
  performance: '#22c55e',
  accessibility: '#a855f7',
  best_practices: '#f97316',
}

export default function ScoreTrajectory({ siteId }: { siteId: string }) {
  const [scores, setScores] = useState<ScorePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['overall'])

  useEffect(() => {
    fetch(`/api/tracking/scores?site_id=${siteId}`)
      .then((res) => res.json())
      .then((data) => {
        setScores(data.scores || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [siteId])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">Score Trajectory</h3>
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="animate-pulse text-sm text-gray-400">Loading trajectory data...</p>
        </div>
      </div>
    )
  }

  if (scores.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">Score Trajectory</h3>
        <div className="mt-4 flex h-48 items-center justify-center">
          <p className="text-sm text-gray-400">Run audits to see your score trajectory over time.</p>
        </div>
      </div>
    )
  }

  const metrics = [
    { key: 'overall', label: 'Overall', color: COLORS.overall },
    { key: 'seo', label: 'SEO', color: COLORS.seo },
    { key: 'performance', label: 'Performance', color: COLORS.performance },
    { key: 'accessibility', label: 'Accessibility', color: COLORS.accessibility },
    { key: 'best_practices', label: 'Best Practices', color: COLORS.best_practices },
  ]

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
  }

  // SVG chart dimensions
  const W = 600
  const H = 200
  const PAD = 40

  const maxScore = 100
  const minScore = 0
  const xStep = scores.length > 1 ? (W - PAD * 2) / (scores.length - 1) : 0

  const getY = (score: number | null) => {
    if (score === null) return H - PAD
    return H - PAD - ((score - minScore) / (maxScore - minScore)) * (H - PAD * 2)
  }

  const getPath = (key: string) => {
    const scoreKey = `${key}_score` as keyof ScorePoint
    return scores
      .map((s, i) => {
        const x = PAD + i * xStep
        const y = getY(s[scoreKey] as number | null)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }

  // Calculate trend for the latest vs previous
  const latestScore = scores[scores.length - 1]?.overall_score
  const prevScore = scores.length > 1 ? scores[scores.length - 2]?.overall_score : null
  const trend =
    latestScore !== null && prevScore !== null
      ? latestScore > prevScore
        ? 'up'
        : latestScore < prevScore
        ? 'down'
        : 'stable'
      : 'stable'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Score Trajectory</h3>
          <p className="mt-1 text-sm text-gray-500">
            {scores.length} audit{scores.length !== 1 ? 's' : ''} tracked
            {trend === 'up' && <span className="ml-2 text-green-600">↑ Improving</span>}
            {trend === 'down' && <span className="ml-2 text-red-600">↓ Declining</span>}
            {trend === 'stable' && <span className="ml-2 text-gray-500">→ Stable</span>}
          </p>
        </div>
      </div>

      {/* Metric toggles */}
      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedMetrics.includes(m.key)
                ? 'text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={
              selectedMetrics.includes(m.key)
                ? { backgroundColor: m.color }
                : undefined
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ minWidth: '400px' }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD}
                y1={getY(v)}
                x2={W - PAD}
                y2={getY(v)}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={PAD - 8}
                y={getY(v) + 4}
                textAnchor="end"
                className="fill-gray-400"
                fontSize="10"
              >
                {v}
              </text>
            </g>
          ))}

          {/* Date labels */}
          {scores.map((s, i) => {
            // Only show every Nth label to avoid overlap
            const showLabel = scores.length <= 5 || i % Math.ceil(scores.length / 5) === 0 || i === scores.length - 1
            if (!showLabel) return null
            return (
              <text
                key={i}
                x={PAD + i * xStep}
                y={H - 8}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize="9"
              >
                {new Date(s.recorded_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </text>
            )
          })}

          {/* Score lines */}
          {selectedMetrics.map((key) => {
            const color = metrics.find((m) => m.key === key)?.color || '#6366f1'
            return (
              <g key={key}>
                <path
                  d={getPath(key)}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {scores.map((s, i) => {
                  const scoreKey = `${key}_score` as keyof ScorePoint
                  const score = s[scoreKey] as number | null
                  if (score === null) return null
                  return (
                    <circle
                      key={i}
                      cx={PAD + i * xStep}
                      cy={getY(score)}
                      r="4"
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
