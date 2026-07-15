import { getProvider } from './_providers'
import { demoDiscover } from '../src/discovery/demoDiscover'
import { hasUsableDiscovery } from '../src/discovery/normalizeDiscover'

// Framework-agnostic discovery core. Both the Vercel function (api/discover.ts)
// and the local Vite dev middleware call this, so live discovery works the same
// whether deployed or running `npm run dev`. It only reads the search key from
// the server environment and never returns it.

const TIMEOUT_MS = 12_000

export interface CoreResult {
  status: number
  body: Record<string, unknown>
}

function demoBody(topic: string, note: string): Record<string, unknown> {
  return { ...demoDiscover(topic), mode: 'demo', provider: 'seeded', note }
}

export async function runDiscover(topicRaw: unknown): Promise<CoreResult> {
  const topic = typeof topicRaw === 'string' ? topicRaw.trim() : ''
  if (!topic) {
    return { status: 400, body: { error: 'Missing "topic" in request body.' } }
  }

  const provider = getProvider()

  // No provider/key configured → honest seeded demo, still 200 so the app works.
  if (!provider || !provider.isConfigured()) {
    return {
      status: 200,
      body: demoBody(
        topic,
        'No search key configured on the host — returning seeded, illustrative data.',
      ),
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const payload = await provider.discover(topic, controller.signal)
    clearTimeout(timer)

    if (!hasUsableDiscovery(payload)) {
      return {
        status: 200,
        body: demoBody(
          topic,
          `${provider.name} returned no usable results — showing seeded data instead.`,
        ),
      }
    }
    return {
      status: 200,
      body: { ...payload, mode: 'live', provider: provider.name },
    }
  } catch (err) {
    clearTimeout(timer)
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `${provider.name} timed out`
        : `${provider.name} request failed`
    return { status: 200, body: demoBody(topic, `${reason} — showing seeded data instead.`) }
  }
}
