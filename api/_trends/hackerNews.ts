import type { TrendTopic } from '../../src/discovery/types'
import type { TrendSource } from './types'
import { compactNumber } from './types'

// Hacker News Firebase API — fully open, no key. Strong signal for tech / SaaS /
// product trends.
const TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`

interface HnItem {
  title?: string
  url?: string
  score?: number
  id?: number
}

// Algolia HN Search — keyword search over stories, ranked by popularity.
interface AlgoliaHit {
  title?: string
  url?: string
  objectID?: string
  points?: number
}

async function algoliaSearch(query: string, signal: AbortSignal): Promise<TrendTopic[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
    query,
  )}&tags=story&hitsPerPage=8`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`hn-algolia ${res.status}`)
  const data = (await res.json()) as { hits?: AlgoliaHit[] }
  return (data.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      title: h.title as string,
      source: 'Hacker News',
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      meta: typeof h.points === 'number' ? `${compactNumber(h.points)} points` : undefined,
    }))
}

export const hackerNewsSource: TrendSource = {
  name: 'Hacker News',
  search: (query, signal) => algoliaSearch(query, signal),

  async fetch(signal): Promise<TrendTopic[]> {
    const res = await fetch(TOP, { signal })
    if (!res.ok) throw new Error(`hn ${res.status}`)
    const ids = (await res.json()) as number[]
    const top = Array.isArray(ids) ? ids.slice(0, 8) : []

    const items = await Promise.all(
      top.map(async (id) => {
        try {
          const r = await fetch(ITEM(id), { signal })
          if (!r.ok) return null
          return (await r.json()) as HnItem
        } catch {
          return null
        }
      }),
    )

    return items
      .filter((i): i is HnItem => !!i && !!i.title)
      .map((i) => ({
        title: i.title as string,
        source: 'Hacker News',
        url: i.url || `https://news.ycombinator.com/item?id=${i.id}`,
        meta: typeof i.score === 'number' ? `${compactNumber(i.score)} points` : undefined,
      }))
  },
}
