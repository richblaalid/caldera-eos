/**
 * Brave Search API client for industry news curation.
 * Used by EA briefing to populate Tier 3 with real industry news.
 * Free tier: 100 searches/day — more than enough for daily briefings.
 */

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search'
const TIMEOUT_MS = 5000

export interface NewsItem {
  title: string
  detail: string
  source: string
}

/** Default search topics relevant to Caldera's business */
const DEFAULT_TOPICS = [
  'AI software consulting services market trends 2026',
  'enterprise software development value-based pricing',
  'EOS Traction business operating system news',
]

/**
 * Fetch industry news from Brave Search API.
 * Returns 3-5 curated results with title, snippet, and URL.
 * Gracefully returns [] on any failure.
 */
export async function fetchIndustryNews(
  topics: string[] = DEFAULT_TOPICS
): Promise<NewsItem[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) {
    console.log('BRAVE_SEARCH_API_KEY not set — skipping industry news')
    return []
  }

  try {
    const results: NewsItem[] = []

    // Search each topic (limit to 2 per topic to keep it concise)
    for (const topic of topics.slice(0, 3)) {
      const items = await searchBrave(apiKey, topic, 2)
      results.push(...items)
    }

    // Deduplicate by title similarity and return top 5
    return deduplicateResults(results).slice(0, 5)
  } catch (error) {
    console.error('Industry news fetch failed:', error)
    return []
  }
}

async function searchBrave(
  apiKey: string,
  query: string,
  count: number
): Promise<NewsItem[]> {
  const url = new URL(BRAVE_SEARCH_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(count))
  url.searchParams.set('freshness', 'pw') // past week

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`Brave Search API error: ${response.status}`)
      return []
    }

    const data = await response.json() as BraveSearchResponse

    return (data.web?.results || []).map(result => ({
      title: result.title,
      detail: result.description || '',
      source: result.url,
    }))
  } finally {
    clearTimeout(timeout)
  }
}

function deduplicateResults(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    // Normalize title for dedup
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Brave Search API response types
interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string
      description: string
      url: string
    }>
  }
}
