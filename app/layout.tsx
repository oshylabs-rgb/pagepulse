import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'PagePulse — AI-Powered SEO Audit & Monitoring',
  description:
    'Instantly audit your website SEO, track scores over time, and get AI-powered recommendations to improve your search rankings.',
  openGraph: {
    title: 'PagePulse — AI-Powered SEO Audit & Monitoring',
    description:
      'Instantly audit your website SEO, track scores over time, and get AI-powered recommendations.',
    url: 'https://pagepulse.io',
    siteName: 'PagePulse',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
