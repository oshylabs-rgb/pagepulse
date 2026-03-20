import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RunAuditButton from '@/components/audit/RunAuditButton'

export default async function SitePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single()

  if (!site) notFound()

  const { data: audits } = await supabase
    .from('audits')
    .select('*')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            ← Back to sites
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{site.name}</h1>
          <p className="text-sm text-gray-500">{site.url}</p>
        </div>
        <RunAuditButton siteId={site.id} siteUrl={site.url} />
      </div>

      {/* Audit history */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Audit History</h2>
        <div className="mt-4 space-y-3">
          {audits?.map((audit) => (
            <Link
              key={audit.id}
              href={`/dashboard/site/${site.id}/audit/${audit.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-sm"
            >
              <div>
                <p className="text-sm text-gray-500">
                  {new Date(audit.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Status: {audit.status}
                </p>
              </div>
              {audit.overall_score !== null && (
                <span
                  className={`text-2xl font-bold ${
                    audit.overall_score >= 80
                      ? 'text-green-600'
                      : audit.overall_score >= 50
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {audit.overall_score}
                </span>
              )}
              {audit.status === 'running' && (
                <span className="text-sm text-indigo-600 animate-pulse">Running...</span>
              )}
            </Link>
          ))}

          {(!audits || audits.length === 0) && (
            <p className="text-sm text-gray-400">
              No audits yet. Click &quot;Run Audit&quot; to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
