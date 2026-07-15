import type { TrendGroup, UnavailableSource } from '../../src/discovery/types'
import type { TrendSource, TrendContext } from './types'
import { googleTrendsSource } from './googleTrends'
import { googleNewsSource } from './googleNews'
import { wikipediaSource } from './wikipedia'
import { hackerNewsSource } from './hackerNews'
import { redditSource } from './reddit'
import { youtubeSource } from './youtube'

// Keyless-first ordering. Add sources here; the handler/frontend never change.
// Google Trends leads (the actual trending SEARCHES, via the current /trending/rss
// endpoint), followed by Google News (top stories) and the rest.
const SOURCES: TrendSource[] = [
  googleTrendsSource,
  googleNewsSource,
  wikipediaSource,
  youtubeSource,
  hackerNewsSource,
  redditSource,
]

// Sources we deliberately DON'T fake. Honesty over fake Instagram data.
const HONEST_GAPS: UnavailableSource[] = [
  {
    source: 'Instagram / Facebook',
    reason:
      "Meta's API doesn't expose general trending hashtags; real trend data needs paid third-party vendors or scraping (against ToS). Not shown rather than faked.",
  },
]

const PER_SOURCE_MS = 8_000

// Finance-sector mode: search-capable sources query this; keyless "what's hot"
// sources (Google Trends, Wikipedia) are fetched normally then filtered to items
// that match the finance lexicon, so the sector board is real, not client-faked.
const FINANCE_QUERY =
  'personal finance OR credit cards OR banking OR mortgage OR interest rates OR loans OR fintech'
const FINANCE_RE =
  /\b(credit|cards?|apr|apy|interest|loans?|mortgages?|debt|bank(ing|s)?|financ(e|ial)|money|savings?|deposit|rewards?|cash ?back|fees?|fed|federal reserve|rates?|inflation|irs|tax(es)?|invest(ing|ment|ors?)?|stocks?|market|budget|payments?|fico|fraud|scam|overdraft|fintech|crypto|bitcoin|paypal|venmo|zelle|visa|mastercard|amex|chase|capital one|wells fargo|equifax|experian|transunion)\b/i

// Maps a source's requiresKey → the host env var that can also satisfy it.
const ENV_FOR_KEY: Record<string, string> = {
  youtube: 'YOUTUBE_API_KEY',
}

function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), PER_SOURCE_MS)
  return p(c.signal).finally(() => clearTimeout(t))
}

export interface AggregateResult {
  groups: TrendGroup[]
  unavailable: UnavailableSource[]
  anyLive: boolean
}

/** Resolve a source's key from the request first, then the host env. */
function resolveKey(source: TrendSource, requestKeys: Record<string, string>): string {
  if (!source.requiresKey) return ''
  const fromReq = requestKeys[source.requiresKey]
  if (fromReq && fromReq.trim()) return fromReq.trim()
  const envName = ENV_FOR_KEY[source.requiresKey]
  return (envName && process.env[envName]) || ''
}

/**
 * Fetch every configured source in parallel. Each source is independently
 * guarded — a throw/timeout becomes an empty group, never a failed board.
 */
export async function aggregateTrends(
  requestKeys: Record<string, string> = {},
  query = '',
  sector = '',
): Promise<AggregateResult> {
  const q = query.trim()
  const finance = sector === 'finance'
  const configured: TrendSource[] = []
  const unconfigured: TrendSource[] = []
  const ctxKeys: Record<string, string> = {}

  for (const s of SOURCES) {
    // In an explicit keyword search, only sources that can query are eligible.
    // In finance-sector mode every source contributes (search or fetch+filter).
    if (q && !finance && !s.search) continue
    if (!s.requiresKey) {
      configured.push(s)
      continue
    }
    const key = resolveKey(s, requestKeys)
    if (key) {
      ctxKeys[s.requiresKey] = key
      configured.push(s)
    } else {
      unconfigured.push(s)
    }
  }
  const ctx: TrendContext = { keys: ctxKeys }
  const byName = new Map(configured.map((s) => [s.name, s]))

  const settled = await Promise.all(
    configured.map(async (s): Promise<TrendGroup> => {
      try {
        // Explicit keyword → search. Finance mode → search only sources flagged
        // 'search' (News); the rest fetch what's hot then keep finance items.
        const financeSearch = finance && (s.financeStrategy ?? 'filter') === 'search'
        const useSearch = !!s.search && (!!q || financeSearch)
        const searchQuery = q || (financeSearch ? FINANCE_QUERY : '')
        const items = await withTimeout((sig) =>
          useSearch ? s.search!(searchQuery, sig, ctx) : s.fetch(sig, ctx),
        )
        const out =
          finance && !useSearch
            ? items.filter((it) => FINANCE_RE.test(`${it.title} ${it.context ?? ''} ${it.meta ?? ''}`))
            : items
        return { source: s.name, live: out.length > 0, items: out }
      } catch {
        return { source: s.name, live: false, items: [], note: 'source unavailable right now' }
      }
    }),
  )

  const groups = settled.filter((g) => g.items.length > 0)
  const anyLive = groups.length > 0

  // A configured keyless source that returned nothing (blocked / rate-limited /
  // quiet) must NOT vanish silently — surface it with a reason so the board is
  // honest about what's missing and why.
  const quiet = settled.filter((g) => g.items.length === 0)

  const unavailable: UnavailableSource[] = [
    ...quiet.map((g) => ({
      source: g.source,
      reason:
        byName.get(g.source)?.unavailableReason ||
        (finance
          ? 'No finance-relevant items in this source right now.'
          : 'Quiet or rate-limited right now — no items returned.'),
    })),
    ...unconfigured.map((s) => ({
      source: s.name,
      reason: s.unavailableReason || 'Not configured on this host.',
    })),
    ...HONEST_GAPS,
  ]

  return { groups, unavailable, anyLive }
}
