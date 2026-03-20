import { GoogleGenAI, Type } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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
        },
        required: ['category', 'severity', 'title', 'description', 'suggestion'],
      },
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
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
  ],
}

export async function analyseSEO(url: string, htmlContent: string, headers: Record<string, string>): Promise<SEOAnalysis> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are an expert SEO auditor. Analyse this webpage and return a comprehensive SEO audit.

URL: ${url}

HTTP Headers:
${JSON.stringify(headers, null, 2)}

HTML Content (first 50000 chars):
${htmlContent.substring(0, 50000)}

Analyse: meta tags, headings hierarchy, image alt text, canonical URLs, structured data, mobile responsiveness signals, page speed indicators, link structure, accessibility attributes, security headers, and content quality signals.

For each category score (0-100), be rigorous and specific. Identify real issues found in the HTML.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: seoAnalysisSchema,
    },
  })

  return JSON.parse(response.text!) as SEOAnalysis
}
