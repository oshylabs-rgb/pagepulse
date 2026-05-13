import type { SEOAnalysis } from './gemini'

type Issue = SEOAnalysis['issues'][number]
type Signal = SEOAnalysis['signals'][number]

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now',
  'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she',
  'too', 'use', 'with', 'this', 'that', 'from', 'have', 'will', 'your', 'they', 'their',
  'them', 'then', 'there', 'these', 'those', 'what', 'when', 'where', 'which', 'while',
  'would', 'could', 'should', 'about', 'after', 'again', 'into', 'more', 'over', 'such',
  'than', 'just', 'like', 'also', 'been', 'were', 'some', 'only', 'each', 'because',
  'http', 'https', 'www', 'com', 'org', 'net', 'html', 'body', 'head', 'div', 'span',
])

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function attr(tagHtml: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const m = tagHtml.match(re)
  if (!m) return null
  return (m[1] ?? m[2] ?? m[3] ?? '').trim()
}

function matchOne(html: string, re: RegExp): string | null {
  const m = html.match(re)
  return m ? m[0] : null
}

function matchAll(html: string, re: RegExp): RegExpMatchArray[] {
  const out: RegExpMatchArray[] = []
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = r.exec(html)) !== null) {
    out.push(m as unknown as RegExpMatchArray)
    if (m.index === r.lastIndex) r.lastIndex++
  }
  return out
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

/**
 * Builds an SEOAnalysis purely from HTML, response headers, and URL — no AI.
 * Used as a resilient fallback when the AI provider is unavailable (quota,
 * permission denied, model missing, timeout, etc.) so users still get a
 * useful technical report.
 */
export function generateFallbackAnalysis(
  url: string,
  html: string,
  headers: Record<string, string>
): SEOAnalysis {
  const issues: Issue[] = []
  const signals: Signal[] = []
  const recommendations: string[] = []

  // --- Extract key elements ---
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : ''

  const metaDescTag = matchOne(html, /<meta[^>]+name\s*=\s*["']description["'][^>]*>/i)
  const metaDescription = metaDescTag ? (attr(metaDescTag, 'content') || '') : ''

  const metaViewportTag = matchOne(html, /<meta[^>]+name\s*=\s*["']viewport["'][^>]*>/i)
  const metaViewport = metaViewportTag ? (attr(metaViewportTag, 'content') || '') : ''

  const metaRobotsTag = matchOne(html, /<meta[^>]+name\s*=\s*["']robots["'][^>]*>/i)
  const metaRobots = metaRobotsTag ? (attr(metaRobotsTag, 'content') || '') : ''

  const canonicalTag = matchOne(html, /<link[^>]+rel\s*=\s*["']canonical["'][^>]*>/i)
  const canonicalHref = canonicalTag ? (attr(canonicalTag, 'href') || '') : ''

  const htmlTag = matchOne(html, /<html[^>]*>/i)
  const langAttr = htmlTag ? (attr(htmlTag, 'lang') || '') : ''

  const faviconTag = matchOne(html, /<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]*>/i)

  const h1s = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((m) =>
    stripTags(m[1] || '').slice(0, 200)
  )
  const h2s = matchAll(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map((m) => stripTags(m[1] || '').slice(0, 200))
  const h3s = matchAll(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).map((m) => stripTags(m[1] || '').slice(0, 200))

  const imgTags = matchAll(html, /<img\b[^>]*>/gi).map((m) => m[0])
  const imgsMissingAlt = imgTags.filter((t) => {
    const a = attr(t, 'alt')
    return a === null || a.trim() === ''
  })

  const ogTags = matchAll(html, /<meta[^>]+property\s*=\s*["']og:[^"']+["'][^>]*>/gi)
  const twitterTags = matchAll(html, /<meta[^>]+name\s*=\s*["']twitter:[^"']+["'][^>]*>/gi)

  const structuredData = matchAll(
    html,
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  const allLinks = matchAll(html, /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi).map((m) => m[1] || '')
  let host = ''
  try {
    host = new URL(url).host
  } catch {
    host = ''
  }
  const isInternal = (href: string): boolean => {
    if (!href) return false
    if (href.startsWith('/') && !href.startsWith('//')) return true
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false
    try {
      return new URL(href, url).host === host
    } catch {
      return false
    }
  }
  const internalLinks = allLinks.filter(isInternal)
  const externalLinks = allLinks.filter((l) => l && !isInternal(l) && !l.startsWith('#') && !l.startsWith('mailto:') && !l.startsWith('tel:'))

  const textContent = stripTags(html)
  const wordCount = textContent.split(/\s+/).filter(Boolean).length
  const htmlBytes = Buffer.byteLength(html, 'utf8')

  const isHttps = url.startsWith('https://')
  const hsts = headers['strict-transport-security']
  const xContentTypeOptions = headers['x-content-type-options']
  const xFrameOptions = headers['x-frame-options']
  const referrerPolicy = headers['referrer-policy']
  const csp = headers['content-security-policy']

  // --- Scoring + issues + signals ---

  // SEO score (start at 100, deduct for problems)
  let seoScore = 100
  if (!title) {
    seoScore -= 25
    issues.push({
      category: 'seo',
      severity: 'critical',
      title: 'Missing <title> tag',
      description: 'The page does not have a <title> element. Search engines rely on this for ranking and result snippets.',
      suggestion: 'Add a unique, descriptive <title> (50–60 characters) in the document <head>.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '',
        after: '<title>Your descriptive page title — 50–60 characters</title>',
        explanation: 'Adds a <title> tag inside <head> so search engines and browsers can label the page.',
      },
    })
  } else if (title.length < 30 || title.length > 65) {
    seoScore -= 5
    issues.push({
      category: 'seo',
      severity: 'warning',
      title: `Title length is ${title.length} characters`,
      description: 'Titles outside the 30–65 character range get truncated or look too sparse in search results.',
      suggestion: 'Rewrite the title to be 50–60 characters and front-load primary keywords.',
    })
  }
  signals.push({
    signal_type: 'meta_title',
    signal_value: title || 'missing',
    status: title ? (title.length >= 30 && title.length <= 65 ? 'good' : 'needs_improvement') : 'missing',
    context: 'Search engines use the title tag as the primary label for your page in result pages.',
  })

  if (!metaDescription) {
    seoScore -= 15
    issues.push({
      category: 'seo',
      severity: 'warning',
      title: 'Missing meta description',
      description: 'No <meta name="description"> was found. This often becomes the snippet shown in search results.',
      suggestion: 'Add a meta description (140–160 characters) summarising the page.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '',
        after: '<meta name="description" content="A concise 140–160 character summary of this page that includes your primary keyword." />',
        explanation: 'Provides a search-result snippet and improves click-through rate.',
      },
    })
  } else if (metaDescription.length < 70 || metaDescription.length > 165) {
    seoScore -= 3
    issues.push({
      category: 'seo',
      severity: 'info',
      title: `Meta description length is ${metaDescription.length} characters`,
      description: 'Meta descriptions perform best between 140 and 160 characters.',
      suggestion: 'Tighten or expand the description to 140–160 characters.',
    })
  }
  signals.push({
    signal_type: 'meta_description',
    signal_value: metaDescription || 'missing',
    status: metaDescription ? (metaDescription.length >= 70 && metaDescription.length <= 165 ? 'good' : 'needs_improvement') : 'missing',
    context: 'Drives click-through rate from search result pages.',
  })

  if (h1s.length === 0) {
    seoScore -= 15
    issues.push({
      category: 'seo',
      severity: 'critical',
      title: 'No <h1> heading found',
      description: 'Every page should have exactly one <h1> describing its main topic.',
      suggestion: 'Add a single <h1> near the top of the page summarising the topic.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '',
        after: '<h1>Main page heading describing this page</h1>',
        explanation: 'Establishes the primary topic for search engines and assistive tech.',
      },
    })
  } else if (h1s.length > 1) {
    seoScore -= 5
    issues.push({
      category: 'seo',
      severity: 'warning',
      title: `Multiple <h1> tags (${h1s.length})`,
      description: 'Multiple <h1> elements dilute topic clarity. Use one <h1> and structure subsections with <h2>/<h3>.',
      suggestion: 'Keep one <h1> per page; demote the others to <h2>.',
    })
  }
  signals.push({
    signal_type: 'h1_tag',
    signal_value: h1s[0] || 'missing',
    status: h1s.length === 1 ? 'good' : h1s.length === 0 ? 'missing' : 'needs_improvement',
    context: 'The primary heading reinforces the page topic to search engines and users.',
  })

  if (!canonicalHref) {
    seoScore -= 5
    issues.push({
      category: 'seo',
      severity: 'info',
      title: 'Missing canonical URL',
      description: 'A canonical link helps search engines understand the preferred URL for this content.',
      suggestion: 'Add <link rel="canonical" href="..."> in the <head>.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '',
        after: `<link rel="canonical" href="${url}" />`,
        explanation: 'Tells search engines this is the preferred URL, avoiding duplicate-content issues.',
      },
    })
  }
  signals.push({
    signal_type: 'canonical_url',
    signal_value: canonicalHref || 'missing',
    status: canonicalHref ? 'good' : 'missing',
    context: 'Prevents duplicate content issues across query-string and tracking variants.',
  })

  if (ogTags.length === 0) {
    seoScore -= 3
    issues.push({
      category: 'seo',
      severity: 'info',
      title: 'No Open Graph tags',
      description: 'OG tags control how the page appears when shared on social networks.',
      suggestion: 'Add og:title, og:description, og:image, og:url meta tags.',
    })
  }
  signals.push({
    signal_type: 'og_tags',
    signal_value: ogTags.length > 0 ? `${ogTags.length} tags found` : 'missing',
    status: ogTags.length >= 3 ? 'good' : ogTags.length > 0 ? 'needs_improvement' : 'missing',
    context: 'Open Graph tags drive richer link previews on social networks.',
  })

  signals.push({
    signal_type: 'twitter_cards',
    signal_value: twitterTags.length > 0 ? `${twitterTags.length} tags found` : 'missing',
    status: twitterTags.length >= 2 ? 'good' : twitterTags.length > 0 ? 'needs_improvement' : 'missing',
    context: 'Twitter card tags improve link previews on X/Twitter.',
  })

  signals.push({
    signal_type: 'structured_data',
    signal_value: structuredData.length > 0 ? `${structuredData.length} JSON-LD blocks` : 'missing',
    status: structuredData.length > 0 ? 'good' : 'missing',
    context: 'Schema.org structured data unlocks rich results in search.',
  })
  if (structuredData.length === 0) {
    seoScore -= 4
    issues.push({
      category: 'seo',
      severity: 'info',
      title: 'No structured data (JSON-LD) detected',
      description: 'Adding schema.org markup can unlock rich results (FAQ, breadcrumbs, product, etc.).',
      suggestion: 'Add an appropriate JSON-LD <script type="application/ld+json"> block.',
    })
  }

  // Accessibility score
  let accessibilityScore = 100
  if (!langAttr) {
    accessibilityScore -= 10
    issues.push({
      category: 'accessibility',
      severity: 'warning',
      title: 'Missing lang attribute on <html>',
      description: 'Screen readers and translation tools rely on the lang attribute to pronounce content correctly.',
      suggestion: 'Set <html lang="en"> (or the appropriate language code).',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '<html>',
        after: '<html lang="en">',
        explanation: 'Declares the page language so assistive tech handles content correctly.',
      },
    })
  }
  signals.push({
    signal_type: 'lang_attribute',
    signal_value: langAttr || 'missing',
    status: langAttr ? 'good' : 'missing',
    context: 'Required for accessibility and translation services.',
  })

  const altCoveragePct = imgTags.length === 0 ? 100 : Math.round(((imgTags.length - imgsMissingAlt.length) / imgTags.length) * 100)
  if (imgsMissingAlt.length > 0) {
    const deduction = Math.min(35, imgsMissingAlt.length * 3)
    accessibilityScore -= deduction
    issues.push({
      category: 'accessibility',
      severity: imgsMissingAlt.length > 3 ? 'critical' : 'warning',
      title: `${imgsMissingAlt.length} image${imgsMissingAlt.length === 1 ? '' : 's'} missing alt text`,
      description: 'Images without alt attributes are inaccessible to screen readers and hurt image SEO.',
      suggestion: 'Add descriptive alt text to every <img>. Use alt="" for purely decorative images.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '<img src="example.jpg">',
        after: '<img src="example.jpg" alt="Descriptive text explaining the image" />',
        explanation: 'Provides a text equivalent for the image so assistive tech and search bots can understand it.',
      },
    })
  }
  signals.push({
    signal_type: 'alt_text_coverage',
    signal_value: `${altCoveragePct}% of ${imgTags.length} image${imgTags.length === 1 ? '' : 's'}`,
    status: altCoveragePct >= 95 ? 'good' : altCoveragePct >= 70 ? 'needs_improvement' : 'missing',
    context: 'Alt text is required by WCAG and used by search engines for image indexing.',
  })

  if (!metaViewport) {
    accessibilityScore -= 8
    issues.push({
      category: 'accessibility',
      severity: 'warning',
      title: 'Missing viewport meta tag',
      description: 'Without a viewport meta, the page does not adapt to small screens.',
      suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '',
        after: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        explanation: 'Tells mobile browsers to render the page at device width.',
      },
    })
  }
  signals.push({
    signal_type: 'mobile_viewport',
    signal_value: metaViewport || 'missing',
    status: metaViewport ? 'good' : 'missing',
    context: 'Required for the page to display correctly on mobile devices.',
  })

  // Performance score (rough heuristic from HTML weight and inline assets)
  let performanceScore = 100
  if (htmlBytes > 500_000) {
    performanceScore -= 30
    issues.push({
      category: 'performance',
      severity: 'critical',
      title: `Very large HTML payload (${Math.round(htmlBytes / 1024)} KB)`,
      description: 'A heavy HTML document slows down first paint and Time to Interactive on mobile networks.',
      suggestion: 'Defer or remove unused markup; move long scripts/styles into external files served with caching.',
    })
  } else if (htmlBytes > 200_000) {
    performanceScore -= 15
    issues.push({
      category: 'performance',
      severity: 'warning',
      title: `Large HTML payload (${Math.round(htmlBytes / 1024)} KB)`,
      description: 'Pages above ~200 KB of HTML start to feel slow on slower connections.',
      suggestion: 'Trim inline scripts/styles and audit third-party embeds.',
    })
  }

  const inlineScriptBytes = matchAll(html, /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)
    .reduce((sum, m) => sum + (m[1]?.length || 0), 0)
  if (inlineScriptBytes > 50_000) {
    performanceScore -= 15
    issues.push({
      category: 'performance',
      severity: 'warning',
      title: `Heavy inline JavaScript (${Math.round(inlineScriptBytes / 1024)} KB)`,
      description: 'Large blocks of inline JS block parsing and can not be cached separately.',
      suggestion: 'Move inline scripts into external files with appropriate cache headers; defer non-critical scripts.',
    })
  }

  const scriptTagsExt = matchAll(html, /<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi).map((m) => m[0])
  const blockingScripts = scriptTagsExt.filter((t) => !/\b(?:async|defer|type\s*=\s*["']module["'])\b/i.test(t))
  if (blockingScripts.length > 3) {
    performanceScore -= 10
    issues.push({
      category: 'performance',
      severity: 'warning',
      title: `${blockingScripts.length} render-blocking scripts`,
      description: 'External scripts without async/defer block HTML parsing and delay first paint.',
      suggestion: 'Add defer or async to non-critical <script src="..."> tags.',
      code_fix: {
        language: 'html',
        filename: 'index.html',
        before: '<script src="example.js"></script>',
        after: '<script src="example.js" defer></script>',
        explanation: 'defer lets the browser keep parsing HTML and run the script after parsing.',
      },
    })
  }

  signals.push({
    signal_type: 'content_length',
    signal_value: `${wordCount} words`,
    status: wordCount >= 300 ? 'good' : wordCount >= 100 ? 'needs_improvement' : 'missing',
    context: 'Pages with at least ~300 words tend to rank better for informational queries.',
  })

  signals.push({
    signal_type: 'page_speed_hints',
    signal_value: `${Math.round(htmlBytes / 1024)} KB HTML, ${blockingScripts.length} blocking scripts`,
    status: htmlBytes < 200_000 && blockingScripts.length <= 3 ? 'good' : 'needs_improvement',
    context: 'Smaller HTML and fewer render-blocking scripts improve Core Web Vitals.',
  })

  // Best practices score (security headers + HTTPS + favicon)
  let bestPracticesScore = 100
  if (!isHttps) {
    bestPracticesScore -= 30
    issues.push({
      category: 'best-practices',
      severity: 'critical',
      title: 'Site not served over HTTPS',
      description: 'HTTP traffic is unencrypted and browsers warn users. HTTPS is also a search ranking signal.',
      suggestion: 'Issue a free certificate (e.g. Let’s Encrypt) and redirect all HTTP traffic to HTTPS.',
    })
  }
  signals.push({
    signal_type: 'ssl',
    signal_value: isHttps ? 'HTTPS' : 'HTTP',
    status: isHttps ? 'good' : 'missing',
    context: 'HTTPS is required for modern browser features and is a Google ranking signal.',
  })

  if (!hsts && isHttps) {
    bestPracticesScore -= 6
    issues.push({
      category: 'best-practices',
      severity: 'info',
      title: 'Missing Strict-Transport-Security header',
      description: 'HSTS instructs browsers to always use HTTPS for this domain.',
      suggestion: 'Send Strict-Transport-Security: max-age=31536000; includeSubDomains',
    })
  }
  if (!xContentTypeOptions) {
    bestPracticesScore -= 3
    issues.push({
      category: 'best-practices',
      severity: 'info',
      title: 'Missing X-Content-Type-Options header',
      description: 'Without this header, browsers may MIME-sniff responses.',
      suggestion: 'Send X-Content-Type-Options: nosniff',
    })
  }
  if (!xFrameOptions && !csp) {
    bestPracticesScore -= 3
    issues.push({
      category: 'best-practices',
      severity: 'info',
      title: 'Missing clickjacking protection',
      description: 'Set X-Frame-Options or a CSP frame-ancestors directive to mitigate clickjacking.',
      suggestion: 'Send X-Frame-Options: DENY (or SAMEORIGIN) or Content-Security-Policy: frame-ancestors \'none\'.',
    })
  }
  if (!referrerPolicy) {
    bestPracticesScore -= 2
  }
  if (!faviconTag) {
    bestPracticesScore -= 2
    issues.push({
      category: 'best-practices',
      severity: 'info',
      title: 'Missing favicon',
      description: 'A favicon improves brand recognition in tabs and bookmarks.',
      suggestion: 'Add <link rel="icon" href="/favicon.ico" />.',
    })
  }
  signals.push({
    signal_type: 'favicon',
    signal_value: faviconTag ? 'present' : 'missing',
    status: faviconTag ? 'good' : 'missing',
    context: 'A favicon makes the site recognisable in tabs and history.',
  })

  signals.push({
    signal_type: 'internal_links',
    signal_value: `${internalLinks.length} links`,
    status: internalLinks.length >= 3 ? 'good' : 'needs_improvement',
    context: 'Internal links spread authority and help crawlers discover pages.',
  })
  signals.push({
    signal_type: 'external_links',
    signal_value: `${externalLinks.length} links`,
    status: externalLinks.length > 0 ? 'good' : 'needs_improvement',
    context: 'Linking to high-quality external sources can build topical relevance.',
  })

  if (metaRobots) {
    signals.push({
      signal_type: 'robots_meta',
      signal_value: metaRobots,
      status: /noindex/i.test(metaRobots) ? 'needs_improvement' : 'good',
      context: 'Controls whether search engines can index this page.',
    })
    if (/noindex/i.test(metaRobots)) {
      seoScore -= 20
      issues.push({
        category: 'seo',
        severity: 'critical',
        title: 'Page is marked noindex',
        description: 'The robots meta tag tells search engines not to index this page.',
        suggestion: 'If this page should appear in search, remove the noindex directive.',
      })
    }
  }

  // --- Keywords (frequency over visible text + headings + title) ---
  const tokenSource = [title, metaDescription, ...h1s, ...h2s, ...h3s, textContent].join(' ').toLowerCase()
  const freq = new Map<string, number>()
  for (const raw of tokenSource.split(/[^a-z0-9\-]+/)) {
    if (!raw) continue
    if (raw.length < 4 || raw.length > 30) continue
    if (STOP_WORDS.has(raw)) continue
    if (/^\d+$/.test(raw)) continue
    freq.set(raw, (freq.get(raw) || 0) + 1)
  }
  const keywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k]) => k)

  // --- Recommendations (deduped, action-oriented) ---
  for (const issue of issues) {
    if (issue.severity === 'critical' || issue.severity === 'warning') {
      recommendations.push(issue.suggestion)
    }
  }
  if (recommendations.length === 0) {
    recommendations.push('No critical issues detected by the technical scan. Consider deeper content and backlink analysis next.')
  }

  // --- Final scores ---
  const overall_score = clamp(
    Math.round(
      seoScore * 0.4 + accessibilityScore * 0.2 + performanceScore * 0.2 + bestPracticesScore * 0.2
    )
  )

  return {
    overall_score,
    performance_score: clamp(performanceScore),
    seo_score: clamp(seoScore),
    accessibility_score: clamp(accessibilityScore),
    best_practices_score: clamp(bestPracticesScore),
    issues,
    recommendations: Array.from(new Set(recommendations)).slice(0, 15),
    keywords_detected: keywords,
    signals,
  }
}
