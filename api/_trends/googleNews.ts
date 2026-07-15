import type { TrendTopic } from '../../src/discovery/types'
import type { TrendSource } from './types'
import { stripTags } from './types'

// Google News top-stories RSS — keyless and reliable (unlike Google Trends,
// whose public feeds were removed). A strong "what's in the news right now"
// signal. Region via TRENDS_GEO (country code).
const GEO = process.env.TRENDS_GEO || 'US'
const TOP_FEED = `https://news.google.com/rss?hl=en-${GEO}&gl=${GEO}&ceid=${GEO}:en`
const searchFeed = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-${GEO}&gl=${GEO}&ceid=${GEO}:en`

async function fetchFeed(url: string, signal: AbortSignal): Promise<TrendTopic[]> {
  const res = await fetch(url, {
    signal,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; TrendLens/1.0)' },
  })
  if (!res.ok) throw new Error(`google-news ${res.status}`)
  const xml = await res.text()
  const items = xml.split('<item>').slice(1, 12)
  const out: TrendTopic[] = []
  for (const block of items) {
    const rawTitle = stripTags(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
    if (!rawTitle) continue
    // Google News titles are "Headline - Publisher" — split the publisher off.
    const m = rawTitle.match(/^(.*?)\s+-\s+([^-]+)$/)
    const title = m ? m[1].trim() : rawTitle
    const publisher = m ? m[2].trim() : undefined
    const link = stripTags(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '')
    out.push({
      title,
      source: 'Google News',
      url: link || `https://news.google.com/search?q=${encodeURIComponent(title)}`,
      meta: publisher,
    })
  }
  return out.slice(0, 8)
}

export const googleNewsSource: TrendSource = {
  name: 'Google News',
  financeStrategy: 'search', // News full-text search is strong for the finance query
  fetch: (signal) => fetchFeed(TOP_FEED, signal),
  search: (query, signal) => fetchFeed(searchFeed(query), signal),
}
