import type { SearchProvider } from './types'
import { tavilyProvider } from './tavily'

// Registry. Add Serper/NewsAPI/etc. here — the handler and frontend never change.
const PROVIDERS: Record<string, SearchProvider> = {
  tavily: tavilyProvider,
}

/**
 * Resolve the active provider from SEARCH_PROVIDER (default: tavily).
 * Returns null if the name is unknown.
 */
export function getProvider(): SearchProvider | null {
  const name = (process.env.SEARCH_PROVIDER || 'tavily').toLowerCase()
  return PROVIDERS[name] ?? null
}
