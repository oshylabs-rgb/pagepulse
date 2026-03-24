'use client'

import { useState } from 'react'

interface CodeFix {
  language: string
  filename: string
  before: string
  after: string
  explanation: string
}

export default function CodeFixBlock({ fix }: { fix: CodeFix }) {
  const [copied, setCopied] = useState<'before' | 'after' | null>(null)
  const [showBefore, setShowBefore] = useState(false)

  const copyToClipboard = async (text: string, type: 'before' | 'after') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500">{fix.filename}</span>
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 uppercase">
            {fix.language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {fix.before && (
            <button
              onClick={() => setShowBefore(!showBefore)}
              className="text-xs text-gray-500 hover:text-gray-700 transition"
            >
              {showBefore ? 'Hide original' : 'Show original'}
            </button>
          )}
        </div>
      </div>

      {/* Before code (collapsible) */}
      {showBefore && fix.before && (
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between bg-red-50 px-4 py-1.5">
            <span className="text-xs font-medium text-red-600">Before (current code)</span>
            <button
              onClick={() => copyToClipboard(fix.before, 'before')}
              className="text-xs text-red-500 hover:text-red-700 transition"
            >
              {copied === 'before' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto p-4 text-sm text-red-800 bg-red-50/50">
            <code>{fix.before}</code>
          </pre>
        </div>
      )}

      {/* After code (always visible) */}
      <div>
        <div className="flex items-center justify-between bg-green-50 px-4 py-1.5">
          <span className="text-xs font-medium text-green-600">
            {fix.before ? 'After (fixed code)' : 'Add this code'}
          </span>
          <button
            onClick={() => copyToClipboard(fix.after, 'after')}
            className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 transition"
          >
            {copied === 'after' ? '✓ Copied' : 'Copy Fix'}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-sm text-green-800 bg-green-50/30">
          <code>{fix.after}</code>
        </pre>
      </div>

      {/* Explanation */}
      <div className="border-t border-gray-200 bg-white px-4 py-2.5">
        <p className="text-xs text-gray-600">
          <span className="font-medium">What this does:</span> {fix.explanation}
        </p>
      </div>
    </div>
  )
}
