import type { DiscoverPayload } from '../../src/discovery/types'

// A search provider is anything that can turn a topic into the normalized
// discovery shape server-side. Swap providers (Tavily → Serper → NewsAPI …)
// without touching the frontend or the /api/discover handler.
export interface SearchProvider {
  readonly name: string
  /** True when the required env key(s) are present. */
  isConfigured(): boolean
  /** Discover + normalize for a topic. Must honor the abort signal. */
  discover(topic: string, signal: AbortSignal): Promise<DiscoverPayload>
}

// Community / conversation domains → classified as "buzz" rather than
// competitor content.
export const COMMUNITY_DOMAINS = [
  'reddit.com',
  'news.ycombinator.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'quora.com',
  'medium.com',
  'substack.com',
  'youtube.com',
  'facebook.com',
  'threads.net',
  'mastodon.social',
]

export function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function isCommunity(u: string): boolean {
  const h = hostOf(u)
  return COMMUNITY_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`))
}
