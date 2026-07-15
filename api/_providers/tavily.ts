import type {
  DiscoverPayload,
  TrendingItem,
  Competitor,
  BuzzItem,
  Momentum,
  Sentiment,
} from '../../src/discovery/types'
import { normalizeDiscoverPayload } from '../../src/discovery/normalizeDiscover'
import type { SearchProvider } from './types'
import { hostOf, isCommunity } from './types'

interface TavilyResult {
  title?: string
  url?: string
  content?: string
  published_date?: string
}

const ENDPOINT = 'https://api.tavily.com/search'
const RESULT_CAP = 8

// --- lightweight heuristics (honest, no fabrication — derived from returned text) ---

const POS = /\b(love|great|excellent|amazing|best|helpful|impressive|win|breakthrough|excited|works? well)\b/i
const NEG = /\b(hate|bad|worst|useless|disappoint|fail|broken|scam|overrated|tired|frustrat|concern|risk)\b/i

function sentimentOf(text: string): Sentiment {
  const pos = POS.test(text)
  const neg = NEG.test(text)
  if (pos && !neg) return 'positive'
  if (neg && !pos) return 'negative'
  return 'mixed'
}

function momentumOf(published: string | undefined, nowMs: number): Momentum {
  if (!published) return 'steady'
  const t = Date.parse(published)
  if (Number.isNaN(t)) return 'steady'
  const days = (nowMs - t) / 86_400_000
  if (days <= 4) return 'new'
  if (days <= 21) return 'rising'
  return 'steady'
}

function angleOf(title: string, topic: string): string {
  const t = title.toLowerCase()
  if (/\bvs\.?\b|\bcompared?\b/.test(t)) return 'comparison'
  if (/\bhow to\b|\bguide\b|\btutorial\b/.test(t)) return 'practical how-to'
  if (/\bbest\b|\btop \d/.test(t)) return 'roundup / listicle'
  if (/\bwhy\b|\bmyth|\bwrong\b/.test(t)) return 'contrarian / opinion'
  if (/\bdata\b|\breport\b|\bstudy\b|\bsurvey\b|\bbenchmark\b/.test(t)) return 'data-backed'
  if (/\b202\d\b|\btrend/.test(t)) return 'trends / state-of'
  return `${topic} coverage`
}

function brandFromHost(u: string): string {
  const h = hostOf(u)
  const core = h.split('.').slice(-2, -1)[0] || h
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : 'Publisher'
}

function trim(text: string, n: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean
}

async function tavilySearch(
  apiKey: string,
  query: string,
  topic: 'general' | 'news',
  signal: AbortSignal,
): Promise<TavilyResult[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      topic,
      search_depth: 'basic',
      max_results: RESULT_CAP,
      include_answer: false,
      ...(topic === 'news' ? { days: 30 } : {}),
    }),
  })
  if (!res.ok) throw new Error(`tavily ${res.status}`)
  const data = (await res.json()) as { results?: TavilyResult[] }
  return Array.isArray(data.results) ? data.results : []
}

export const tavilyProvider: SearchProvider = {
  name: 'tavily',

  isConfigured() {
    return !!process.env.TAVILY_API_KEY
  },

  async discover(topic, signal): Promise<DiscoverPayload> {
    const apiKey = process.env.TAVILY_API_KEY as string
    const nowMs = Date.now()

    // Two targeted queries: recent news → trending; broad → competitors + buzz.
    const [news, broad] = await Promise.all([
      tavilySearch(apiKey, `${topic} news trends`, 'news', signal),
      tavilySearch(
        apiKey,
        `${topic} brands companies reviews opinions discussion`,
        'general',
        signal,
      ),
    ])

    const trending: TrendingItem[] = news.slice(0, 6).map((r) => ({
      title: r.title || '(untitled)',
      summary: trim(r.content || '', 180),
      url: r.url || '',
      source: brandFromHost(r.url || ''),
      angle: angleOf(r.title || '', topic),
      momentum: momentumOf(r.published_date, nowMs),
    }))

    const competitors: Competitor[] = []
    const buzz: BuzzItem[] = []
    for (const r of broad) {
      const u = r.url || ''
      if (isCommunity(u)) {
        buzz.push({
          quote: trim(r.content || r.title || '', 200),
          source: brandFromHost(u),
          url: u,
          sentiment: sentimentOf(`${r.title || ''} ${r.content || ''}`),
        })
      } else {
        competitors.push({
          name: brandFromHost(u),
          angle: angleOf(r.title || '', topic),
          url: u,
          summary: trim(r.content || r.title || '', 180),
        })
      }
    }

    const sources = [...news, ...broad]
      .filter((r) => r.url)
      .map((r) => ({ title: r.title || r.url || '', url: r.url || '' }))

    // Final defensive pass shared with the frontend/demo path.
    return normalizeDiscoverPayload({ trending, competitors, buzz, sources })
  },
}
