import type { DiscoverPayload, Mode } from './types'
import { demoDiscover } from './demoDiscover'
import { normalizeDiscoverPayload, hasUsableDiscovery } from './normalizeDiscover'

export interface DiscoverOutcome {
  payload: DiscoverPayload
  mode: Mode
  provider?: string
  note?: string
}

const SEEDED_NOTE = 'Seeded illustrative data — the discovery function was unavailable.'

/**
 * Calls the /api/discover serverless function (which holds the search key). The
 * browser NEVER talks to the search API directly. On any failure — 404 (no
 * function in `vite dev`), network error, malformed body, or a demo payload —
 * we fall back to the identical seeded generator so the app always works.
 */
export async function discoverTopic(topic: string): Promise<DiscoverOutcome> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!res.ok) throw new Error(`discover ${res.status}`)
    const data = (await res.json()) as Record<string, unknown>
    if (data.error) throw new Error(String(data.error))

    const payload = normalizeDiscoverPayload(data)
    if (!hasUsableDiscovery(payload)) throw new Error('empty payload')

    const mode: Mode = data.mode === 'live' ? 'live' : 'demo'
    return {
      payload,
      mode,
      provider: typeof data.provider === 'string' ? data.provider : undefined,
      note: typeof data.note === 'string' ? data.note : undefined,
    }
  } catch {
    return {
      payload: demoDiscover(topic),
      mode: 'demo',
      provider: 'seeded',
      note: SEEDED_NOTE,
    }
  }
}
