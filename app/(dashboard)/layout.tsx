import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/layout/SignOutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
            PagePulse
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              Sites
            </Link>
            <Link href="/dashboard/settings" className="text-sm text-gray-600 hover:text-gray-900">
              Settings
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
