import type {
  DiscoverPayload,
  TrendingItem,
  Competitor,
  BuzzItem,
  SourceRef,
  Momentum,
  Sentiment,
} from './types'

// Defensive validation/normalization for any discovery payload — whether it
// comes from the serverless provider or straight from the demo generator. Bad
// items are dropped, enums are coerced, and counts are capped. Used on BOTH
// sides so a malformed provider response can never reach the UI.

const CAPS = { trending: 6, competitors: 6, buzz: 6, sources: 24 }

function s(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function url(v: unknown): string {
  const val = s(v)
  return /^https?:\/\//i.test(val) ? val : ''
}

function momentum(v: unknown): Momentum {
  return v === 'rising' || v === 'steady' || v === 'new' ? v : 'steady'
}

function sentiment(v: unknown): Sentiment {
  return v === 'positive' || v === 'negative' || v === 'mixed' ? v : 'mixed'
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

export function normalizeDiscoverPayload(raw: unknown): DiscoverPayload {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const trending: TrendingItem[] = asArray(r.trending)
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((o) => ({
      title: s(o.title),
      summary: s(o.summary),
      url: url(o.url),
      source: s(o.source, 'source'),
      angle: s(o.angle, 'general coverage'),
      momentum: momentum(o.momentum),
    }))
    .filter((t) => t.title)
    .slice(0, CAPS.trending)

  const competitors: Competitor[] = asArray(r.competitors)
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((o) => ({
      name: s(o.name),
      angle: s(o.angle, 'general coverage'),
      url: url(o.url),
      summary: s(o.summary),
    }))
    .filter((c) => c.name)
    .slice(0, CAPS.competitors)

  const buzz: BuzzItem[] = asArray(r.buzz)
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((o) => ({
      quote: s(o.quote),
      source: s(o.source, 'community'),
      url: url(o.url),
      sentiment: sentiment(o.sentiment),
    }))
    .filter((b) => b.quote)
    .slice(0, CAPS.buzz)

  const sources: SourceRef[] = asArray(r.sources)
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((o) => ({ title: s(o.title), url: url(o.url) }))
    .filter((x) => x.title && x.url)
    .slice(0, CAPS.sources)

  return { trending, competitors, buzz, sources }
}

/** A payload is usable only if it has at least some trending signal. */
export function hasUsableDiscovery(p: DiscoverPayload): boolean {
  return p.trending.length > 0 || p.competitors.length > 0 || p.buzz.length > 0
}
