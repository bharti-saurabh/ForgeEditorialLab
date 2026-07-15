import type { TrendTopic } from '../../src/discovery/types'
import type { TrendSource } from './types'
import { stripTags } from './types'

// Google Trends — the CURRENT trending searches. Google removed the old
// /trendingsearches/daily/rss feed (404), but the newer /trending/rss endpoint
// works and returns real trending search terms + approximate traffic. Keyless.
// There's no keyword mode (the feed IS the trending list), so no search().
const GEO = process.env.TRENDS_GEO || 'US'
const FEED = `https://trends.google.com/trending/rss?geo=${GEO}`

async function fetchTrends(signal: AbortSignal): Promise<TrendTopic[]> {
  const res = await fetch(FEED, {
    signal,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; TrendLens/1.0)' },
  })
  if (!res.ok) throw new Error(`google-trends ${res.status}`)
  const xml = await res.text()
  const items = xml.split('<item>').slice(1)
  const out: TrendTopic[] = []
  for (const block of items) {
    // The item's own <title> is the trend term (appears before any nested news items).
    const title = stripTags(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
    if (!title) continue
    const traffic = stripTags(block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] || '')
    const newsUrl = stripTags(block.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] || '')
    // The related news headline behind the spike = why it's trending.
    const why = stripTags(block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] || '')
    out.push({
      title,
      source: 'Google Trends',
      url: newsUrl || `https://www.google.com/search?q=${encodeURIComponent(title)}`,
      meta: traffic ? `${traffic} searches` : 'trending search',
      context: why || undefined,
    })
  }
  return out.slice(0, 8)
}

export const googleTrendsSource: TrendSource = {
  name: 'Google Trends',
  fetch: (signal) => fetchTrends(signal),
}
