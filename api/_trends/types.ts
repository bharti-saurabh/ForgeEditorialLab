import type { TrendTopic } from '../../src/discovery/types'

// Resolved keys available to sources for a request. Keys may come from the host
// env (deploy) or the request body (local/personal BYO-key). Keyless sources
// ignore this.
export interface TrendContext {
  keys: Record<string, string>
}

// A trend source surfaces what's trending WITHOUT a topic. Same swap-friendly
// shape as the search providers. Sources must be resilient: on any failure they
// return [] so one dead source never breaks the board.
export interface TrendSource {
  readonly name: string
  /** Name of the key this source needs (e.g. 'youtube'); omit for keyless. */
  readonly requiresKey?: string
  /** Shown honestly in the UI when the required key is absent. */
  readonly unavailableReason?: string
  /** In finance-sector mode: 'search' runs the finance query (good for News-style
   *  full-text sources); default 'filter' fetches what's hot then keeps finance
   *  items (better for ranked "trending" sources like Trends/Wikipedia/HN). */
  readonly financeStrategy?: 'search' | 'filter'
  /** Topic-less "what's hot" fetch. */
  fetch(signal: AbortSignal, ctx: TrendContext): Promise<TrendTopic[]>
  /** Keyword search — present only on sources that can query. */
  search?(query: string, signal: AbortSignal, ctx: TrendContext): Promise<TrendTopic[]>
}

export function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#0?34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}
