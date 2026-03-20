'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AddSiteForm() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAddSite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // Normalise URL
      let normalised = url.trim()
      if (!normalised.startsWith('http')) {
        normalised = `https://${normalised}`
      }

      const urlObj = new URL(normalised)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase.from('sites').insert({
        user_id: user!.id,
        url: urlObj.origin,
        name: urlObj.hostname.replace('www.', ''),
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Site added')
      setUrl('')
      router.refresh()
    } catch {
      toast.error('Please enter a valid URL')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleAddSite} className="mt-6 flex gap-3">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter website URL (e.g. example.com)"
        required
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Site'}
      </button>
    </form>
  )
}
