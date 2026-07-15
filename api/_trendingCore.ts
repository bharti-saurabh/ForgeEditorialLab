import type { TrendingBoard } from '../src/discovery/types'
import { aggregateTrends } from './_trends'
import { demoTrending } from '../src/discovery/demoTrending'

// Framework-agnostic "what's trending now" core. Shared by the Vercel function
// and the Vite dev middleware, so the board is live the same way in both. Fully
// keyless sources (Google Trends, Hacker News, Reddit) make it real out of the
// box; if every source is quiet/blocked, it degrades to the seeded board.

export interface CoreResult {
  status: number
  body: TrendingBoard
}

export async function runTrending(
  requestKeys: Record<string, string> = {},
  query = '',
  sector = '',
): Promise<CoreResult> {
  const q = query.trim()
  const scoped = !!q || sector === 'finance'
  try {
    const { groups, unavailable, anyLive } = await aggregateTrends(requestKeys, q, sector)
    if (!anyLive) {
      // A scoped request (keyword or sector) with nothing found → honest empty
      // board (NOT generic demo, which would misrepresent the query/sector).
      if (scoped) return { status: 200, body: { groups: [], unavailable, mode: 'live' } }
      // General board with everything blocked/quiet → seeded, real unavailable list.
      return { status: 200, body: { ...demoTrending(), unavailable } }
    }
    return { status: 200, body: { groups, unavailable, mode: 'live' } }
  } catch {
    return { status: 200, body: scoped ? { groups: [], unavailable: [], mode: 'demo' } : demoTrending() }
  }
}
