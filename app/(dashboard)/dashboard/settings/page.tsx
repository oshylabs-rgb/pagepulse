import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user!.id)
    .single()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Account */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Email</p>
          <p className="font-medium">{user!.email}</p>
        </div>
      </section>

      {/* Subscription */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Subscription</h2>
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">Current Plan</p>
          <p className="mt-1 text-xl font-bold capitalize">
            {subscription?.plan || 'Free'}
          </p>
          {subscription?.current_period_end && (
            <p className="mt-2 text-sm text-gray-500">
              Renews: {new Date(subscription.current_period_end).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
