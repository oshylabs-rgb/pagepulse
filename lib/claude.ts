import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
  }[]
  recommendations: string[]
}

export async function analyseSEO(url: string, htmlContent: string, headers: Record<string, string>): Promise<SEOAnalysis> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert SEO auditor. Analyse this webpage and return a comprehensive SEO audit.

URL: ${url}

HTTP Headers:
${JSON.stringify(headers, null, 2)}

HTML Content (first 50000 chars):
${htmlContent.substring(0, 50000)}

Return a JSON object with this exact structure:
{
  "overall_score": <0-100>,
  "performance_score": <0-100>,
  "seo_score": <0-100>,
  "accessibility_score": <0-100>,
  "best_practices_score": <0-100>,
  "issues": [
    {
      "category": "seo|performance|accessibility|best-practices",
      "severity": "critical|warning|info",
      "title": "Issue title",
      "description": "Detailed description",
      "element": "Optional: the HTML element or selector",
      "suggestion": "How to fix this"
    }
  ],
  "recommendations": ["Top priority recommendations as strings"]
}

Analyse: meta tags, headings hierarchy, image alt text, canonical URLs, structured data, mobile responsiveness signals, page speed indicators, link structure, accessibility attributes, security headers, and content quality signals.

Return ONLY valid JSON, no markdown fences.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(text) as SEOAnalysis
}
