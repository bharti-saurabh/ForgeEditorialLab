import type { TrendTopic } from '../../src/discovery/types'
import type { TrendSource } from './types'
import { compactNumber } from './types'

// Wikipedia "most read" articles — keyless, reliable. A great signal for what
// the public is actively curious about (culture, people, events).
interface WikiArticle {
  normalizedtitle?: string
  title?: string
  views?: number
  content_urls?: { desktop?: { page?: string } }
}

// Yesterday (UTC) — today's aggregation may not be published yet. `new Date()`
// is fine here: this is live server code, not a deterministic demo generator.
function yesterdayPath(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

const SKIP = /^(Main Page|Special:|Wikipedia:|Portal:|.*_\(disambiguation\))/i

export const wikipediaSource: TrendSource = {
  name: 'Wikipedia',

  async fetch(signal): Promise<TrendTopic[]> {
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${yesterdayPath()}`
    const res = await fetch(url, {
      signal,
      headers: { 'user-agent': 'TrendLens/1.0 (trend discovery)' },
    })
    if (!res.ok) throw new Error(`wikipedia ${res.status}`)
    const data = (await res.json()) as { mostread?: { articles?: WikiArticle[] } }
    const articles = data.mostread?.articles ?? []

    return articles
      .map((a) => ({ ...a, name: a.normalizedtitle || a.title || '' }))
      .filter((a) => a.name && !SKIP.test(a.name))
      .slice(0, 8)
      .map((a) => ({
        title: a.name,
        source: 'Wikipedia',
        url:
          a.content_urls?.desktop?.page ||
          `https://en.wikipedia.org/wiki/${encodeURIComponent(a.name.replace(/ /g, '_'))}`,
        meta: typeof a.views === 'number' ? `${compactNumber(a.views)} views` : undefined,
      }))
  },
}
