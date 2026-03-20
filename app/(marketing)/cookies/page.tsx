import Link from 'next/link'

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-bold">Cookie Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: March 2026</p>

      <div className="prose mt-8 text-gray-700">
        <h2>Essential Cookies</h2>
        <p>
          We use essential cookies to manage your authentication session. These are required for
          the application to function and cannot be disabled.
        </p>

        <h2>Analytics</h2>
        <p>
          We may use privacy-friendly analytics to understand how the product is used. No
          personally identifiable information is shared with third parties.
        </p>

        <h2>Contact</h2>
        <p>Questions? Email hello@oshylabs.com</p>
      </div>
    </main>
  )
}
