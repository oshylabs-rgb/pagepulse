import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddSiteForm from '@/components/dashboard/AddSiteForm'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sites } = await supabase
    .from('sites')
    .select('*, audits(id, overall_score, created_at, status)')
    .eq('user_id', user!.id)
    .eq('audits.status', 'completed')
    .order('created_at', { ascending: false })
    .order('created_at', { foreignTable: 'audits', ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Sites</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add a site and run your first SEO audit.
          </p>
        </div>
      </div>

      <AddSiteForm />

      {/* Sites grid */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sites?.map((site) => {
          const latestAudit = site.audits?.[0]
          return (
            <Link
              key={site.id}
              href={`/dashboard/site/${site.id}`}
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">
                {site.name || site.url}
              </h3>
              <p className="mt-1 truncate text-sm text-gray-500">{site.url}</p>

              {latestAudit && latestAudit.overall_score !== null ? (
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className={`text-2xl font-bold ${
                      latestAudit.overall_score >= 80
                        ? 'text-green-600'
                        : latestAudit.overall_score >= 50
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {latestAudit.overall_score}
                  </span>
                  <span className="text-sm text-gray-400">Latest score</span>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-400">No audits yet</p>
              )}
            </Link>
          )
        })}

        {(!sites || sites.length === 0) && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-400">Add your first site above to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
