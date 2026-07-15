import type { TrendingBoard, TrendGroup } from './types'
import { demoTrending } from './demoTrending'

// Calls the /api/discover function with { action: 'trending' }. Optional
// per-source keys (e.g. YouTube) are passed through for local/personal BYO-key
// use. Falls back to the seeded board on any failure (e.g. 404 on a static host).
export async function fetchTrending(
  keys: Record<string, string> = {},
  query = '',
  sector = '',
): Promise<TrendingBoard> {
  const scoped = !!query.trim() || !!sector
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trending', keys, query, sector }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!res.ok) throw new Error(`trending ${res.status}`)
    const data = (await res.json()) as Partial<TrendingBoard>
    if (!Array.isArray(data.groups)) throw new Error('bad board')

    const groups: TrendGroup[] = data.groups
      .filter((g): g is TrendGroup => !!g && Array.isArray(g.items) && g.items.length > 0)
      .map((g) => ({
        source: String(g.source || 'Source'),
        live: !!g.live,
        note: g.note,
        items: g.items
          .filter((i) => i && typeof i.title === 'string' && i.title.trim())
          .slice(0, 8),
      }))

    const unavailable = Array.isArray(data.unavailable) ? data.unavailable : []
    const mode = data.mode === 'live' ? 'live' : 'demo'

    // An empty scoped request (keyword or sector) is a valid "no results"
    // outcome — don't fall back to the generic demo board (misleading).
    if (!groups.length) {
      if (scoped) return { groups: [], unavailable, mode: 'live' }
      throw new Error('empty board')
    }

    return { groups, unavailable, mode }
  } catch {
    // Only reach the seeded board for the general (unscoped) case.
    if (scoped) return { groups: [], unavailable: [], mode: 'live' }
    return demoTrending()
  }
}
