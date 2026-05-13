import { GoogleGenAI, Type } from '@google/genai'

// Default to a broadly available model. Override with GEMINI_MODEL env var.
// Note: some models (e.g. gemini-2.5-flash) may return 403 PERMISSION_DENIED
// for projects without explicit access, even with a valid API key.
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash'

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
}

let _ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!_ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY is not configured. SEO analysis is unavailable.'
      )
    }
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return _ai
}

export class GeminiPermissionDeniedError extends Error {
  status = 403
  constructor(public model: string, public providerMessage: string) {
    super(
      `AI provider denied access to model "${model}". This usually means the Gemini API key or its Google Cloud project does not have access to this model. Try setting GEMINI_MODEL to a model your project can use (e.g. gemini-1.5-flash), or check your API key restrictions.`
    )
    this.name = 'GeminiPermissionDeniedError'
  }
}

export class GeminiError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
    this.name = 'GeminiError'
  }
}

/**
 * Normalises errors thrown by the @google/genai SDK into user-safe Error
 * instances. The SDK frequently throws errors whose `.message` is the raw
 * provider JSON (e.g. {"error":{"code":403,"message":"...","status":"PERMISSION_DENIED"}}),
 * which must never be surfaced to the UI.
 */
function normaliseGeminiError(err: unknown, model: string): Error {
  const raw = err instanceof Error ? err.message : String(err)

  // Try to parse JSON-shaped provider errors.
  // The SDK sometimes wraps the JSON in a prefix like "got status: 403 ..."
  let parsed: { error?: { code?: number; status?: string; message?: string } } | null = null
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = null
    }
  }

  const code = parsed?.error?.code
  const status = parsed?.error?.status
  const providerMessage = parsed?.error?.message || ''

  if (code === 403 || status === 'PERMISSION_DENIED' || /PERMISSION_DENIED/i.test(raw)) {
    return new GeminiPermissionDeniedError(model, providerMessage || raw)
  }

  if (code === 429 || status === 'RESOURCE_EXHAUSTED' || /quota/i.test(raw)) {
    return new GeminiError(
      'AI provider quota exceeded. Please try again later or check your Gemini API plan.',
      429
    )
  }

  if (code === 404 || status === 'NOT_FOUND') {
    return new GeminiError(
      `AI model "${model}" was not found. Set GEMINI_MODEL to a valid model name (e.g. gemini-1.5-flash).`,
      404
    )
  }

  if (code === 400 || status === 'INVALID_ARGUMENT') {
    return new GeminiError(
      'AI provider rejected the request as invalid. The page may be too large or malformed.',
      400
    )
  }

  return new GeminiError('AI analysis failed. Please try again in a few minutes.', 502)
}

export interface CodeFix {
  language: string
  filename: string
  before: string
  after: string
  explanation: string
}

export interface SEOAnalysis {
  overall_score: number
  performance_score: number
  seo_score: number
  accessibility_score: number
  best_practices_score: number
  issues: {
    category: 'seo' | 'performance' | 'accessibility' | 'best-practices'
    severity: 'critical' | 'warning' | 'info'
    title: string
    description: string
    element?: string
    suggestion: string
    code_fix?: CodeFix
  }[]
  recommendations: string[]
  keywords_detected: string[]
  signals: {
    signal_type: string
    signal_value: string
    status: 'good' | 'needs_improvement' | 'missing'
    context: string
  }[]
}

const seoAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    overall_score: { type: Type.NUMBER },
    performance_score: { type: Type.NUMBER },
    seo_score: { type: Type.NUMBER },
    accessibility_score: { type: Type.NUMBER },
    best_practices_score: { type: Type.NUMBER },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          severity: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          element: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          code_fix: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING },
              filename: { type: Type.STRING },
              before: { type: Type.STRING },
              after: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['language', 'filename', 'before', 'after', 'explanation'],
          },
        },
        required: ['category', 'severity', 'title', 'description', 'suggestion'],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    keywords_detected: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          signal_type: { type: Type.STRING },
          signal_value: { type: Type.STRING },
          status: { type: Type.STRING },
          context: { type: Type.STRING },
        },
        required: ['signal_type', 'signal_value', 'status', 'context'],
      },
    },
  },
  required: [
    'overall_score',
    'performance_score',
    'seo_score',
    'accessibility_score',
    'best_practices_score',
    'issues',
    'recommendations',
    'keywords_detected',
    'signals',
  ],
}

export async function analyseSEO(url: string, htmlContent: string, headers: Record<string, string>): Promise<SEOAnalysis> {
  // Truncate HTML to avoid exceeding token limits
  const truncatedHtml = htmlContent.substring(0, 30000)
  const model = getGeminiModel()

  let response
  try {
    response = await getAI().models.generateContent({
      model,
      contents: `You are an expert SEO auditor and web developer. Analyse this webpage and return a comprehensive SEO audit with ACTIONABLE CODE FIXES.

URL: ${url}

HTTP Headers:
${JSON.stringify(headers, null, 2)}

HTML Content:
${truncatedHtml}

INSTRUCTIONS:
1. Analyse: meta tags, headings hierarchy, image alt text, canonical URLs, structured data, mobile responsiveness signals, page speed indicators, link structure, accessibility attributes, security headers, and content quality signals.

2. For each category score (0-100), be rigorous and specific. Identify real issues found in the HTML.

3. CRITICAL — For EVERY issue you find, provide a "code_fix" object with:
   - "language": The code language (e.g. "html", "css", "javascript", "htaccess", "nginx")
   - "filename": The file this fix applies to (e.g. "index.html", "styles.css", ".htaccess")
   - "before": The EXACT current problematic code snippet from the page
   - "after": The corrected code that fixes the issue
   - "explanation": A 1-2 sentence explanation of what the fix does and why

   The code fixes must be REAL, COPY-PASTEABLE snippets — not pseudocode or descriptions. If the issue is a missing element (e.g. missing meta tag), set "before" to "" and "after" to the code to add.

4. For "keywords_detected": Extract ALL meaningful keywords and phrases found in the page content. Include:
   - Title tag keywords
   - H1-H6 heading keywords
   - Meta description keywords
   - High-frequency content words (exclude stop words)
   - Any structured data keywords
   Return 10-30 keywords/phrases ordered by relevance.

5. For "signals": Identify key SEO signals on the page. Each signal should have:
   - "signal_type": The type (e.g. "meta_title", "meta_description", "h1_tag", "canonical_url", "og_tags", "structured_data", "robots_txt", "sitemap", "ssl", "mobile_viewport", "lang_attribute", "favicon", "alt_text_coverage", "internal_links", "external_links", "page_speed_hints", "content_length")
   - "signal_value": The actual value found (or "missing" if not present)
   - "status": "good", "needs_improvement", or "missing"
   - "context": Brief explanation of why this matters`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: seoAnalysisSchema,
      },
    })
  } catch (err) {
    // Log the raw error server-side for debugging, but throw a normalised one
    console.error('Gemini SDK error:', err)
    throw normaliseGeminiError(err, model)
  }

  const text = response.text
  if (!text) {
    throw new GeminiError('AI analysis returned an empty response. Please try again.', 502)
  }

  try {
    return JSON.parse(text) as SEOAnalysis
  } catch {
    throw new GeminiError('AI analysis returned an unparseable response. Please try again.', 502)
  }
}
