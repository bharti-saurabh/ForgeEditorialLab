import type { TrendTopic } from '../../src/discovery/types'
import type { TrendSource } from './types'
import { compactNumber } from './types'

// Reddit public listing JSON — no key. Best-effort: Reddit sometimes rate-limits
// unauthenticated cloud IPs, so this may return [] on a deployed host. The
// aggregator treats an empty result as "source quiet", never an error.
const SUBS = process.env.REDDIT_SUB || 'popular'
const HOT_URL = `https://www.reddit.com/r/${SUBS}/hot.json?limit=12&raw_json=1`
const searchUrl = (q: string) =>
  `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=hot&limit=12&raw_json=1`

interface RedditChild {
  data?: {
    title?: string
    permalink?: string
    ups?: number
    subreddit_name_prefixed?: string
    stickied?: boolean
    over_18?: boolean
  }
}

async function fetchListing(url: string, signal: AbortSignal): Promise<TrendTopic[]> {
  const res = await fetch(url, {
    signal,
    headers: { 'user-agent': 'TrendLens/1.0 (trend discovery; contact via app)' },
  })
  if (!res.ok) throw new Error(`reddit ${res.status}`)
  const data = (await res.json()) as { data?: { children?: RedditChild[] } }
  const children = data.data?.children ?? []

  return children
    .map((c) => c.data)
    .filter((d): d is NonNullable<RedditChild['data']> => !!d && !!d.title && !d.stickied && !d.over_18)
    .slice(0, 8)
    .map((d) => ({
      title: d.title as string,
      source: 'Reddit',
      url: `https://www.reddit.com${d.permalink ?? ''}`,
      meta: `${d.subreddit_name_prefixed ?? 'reddit'}${
        typeof d.ups === 'number' ? ` · ${compactNumber(d.ups)} upvotes` : ''
      }`,
    }))
}

export const redditSource: TrendSource = {
  name: 'Reddit',
  unavailableReason:
    'Reddit now blocks unauthenticated listing requests (OAuth required). Add Reddit API credentials to enable it — omitted rather than faked.',
  fetch: (signal) => fetchListing(HOT_URL, signal),
  search: (query, signal) => fetchListing(searchUrl(query), signal),
}
