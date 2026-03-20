import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string; auditId: string }>
}) {
  const { id, auditId } = await params
  const supabase = await createClient()

  const { data: audit } = await supabase
    .from('audits')
    .select('*, sites(name, url)')
    .eq('id', auditId)
    .single()

  if (!audit) notFound()

  const scores = [
    { label: 'Overall', value: audit.overall_score, color: 'indigo' },
    { label: 'SEO', value: audit.seo_score, color: 'blue' },
    { label: 'Performance', value: audit.performance_score, color: 'green' },
    { label: 'Accessibility', value: audit.accessibility_score, color: 'purple' },
    { label: 'Best Practices', value: audit.best_practices_score, color: 'orange' },
  ]

  return (
    <div>
      <Link href={`/dashboard/site/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to {audit.sites?.name || 'site'}
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Audit Report</h1>
      <p className="text-sm text-gray-500">
        {new Date(audit.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      {/* Score cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-5">
        {scores.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-200 bg-white p-4 text-center"
          >
            <p className="text-sm text-gray-500">{s.label}</p>
            <p
              className={`mt-2 text-3xl font-bold ${
                (s.value ?? 0) >= 80
                  ? 'text-green-600'
                  : (s.value ?? 0) >= 50
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {s.value ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Issues */}
      {audit.issues && audit.issues.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Issues Found</h2>
          <div className="mt-4 space-y-3">
            {audit.issues.map((issue: { severity: string; title: string; description: string; suggestion: string; category: string }, idx: number) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${
                  issue.severity === 'critical'
                    ? 'border-red-200 bg-red-50'
                    : issue.severity === 'warning'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      issue.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : issue.severity === 'warning'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {issue.category}
                  </span>
                </div>
                <h3 className="mt-2 font-medium">{issue.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{issue.description}</p>
                <p className="mt-2 text-sm font-medium text-gray-800">
                  💡 {issue.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {audit.recommendations && audit.recommendations.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <ul className="mt-4 space-y-2">
            {audit.recommendations.map((rec: string, idx: number) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="mt-0.5 text-indigo-500">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
