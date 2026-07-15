import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runDiscover } from './_discoverCore'
import { runTrending } from './_trendingCore'

// The ONE serverless function. Holds the search key + does discovery
// server-side; it NEVER exposes the key and stores nothing. Routes two actions:
//   { action: 'trending' }            → topic-less "what's trending now" board
//   { topic } (or action: 'discover') → full discovery for a topic
// All logic lives in the *Core modules so the local dev server behaves the same.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }
  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {}
  const b = body as { action?: unknown; topic?: unknown; keys?: unknown; query?: unknown; sector?: unknown }

  if (b.action === 'trending') {
    const keys =
      b.keys && typeof b.keys === 'object' ? (b.keys as Record<string, string>) : {}
    const query = typeof b.query === 'string' ? b.query : ''
    const sector = typeof b.sector === 'string' ? b.sector : ''
    const { status, body: out } = await runTrending(keys, query, sector)
    res.status(status).json(out)
    return
  }

  const { status, body: out } = await runDiscover(b.topic)
  res.status(status).json(out)
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
