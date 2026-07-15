import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { runDiscover } from './api/_discoverCore'
import { runTrending } from './api/_trendingCore'

// Dev-only middleware: serves POST /api/discover locally by calling the SAME
// discovery core the deployed Vercel function uses, so `npm run dev` gives live
// discovery when TAVILY_API_KEY is in .env — no Vercel needed. Runs only in the
// Node dev server; the key never reaches the browser.
function apiDevPlugin(): Plugin {
  return {
    name: 'forge-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/discover', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
          return
        }
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          let parsed: { action?: unknown; topic?: unknown; keys?: unknown; query?: unknown; sector?: unknown } = {}
          try {
            parsed = JSON.parse(raw || '{}')
          } catch {
            /* fall through to core 400 */
          }
          const keys =
            parsed.keys && typeof parsed.keys === 'object'
              ? (parsed.keys as Record<string, string>)
              : {}
          const query = typeof parsed.query === 'string' ? parsed.query : ''
          const sector = typeof parsed.sector === 'string' ? parsed.sector : ''
          const { status, body } =
            parsed.action === 'trending'
              ? await runTrending(keys, query, sector)
              : await runDiscover(parsed.topic)
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env (all keys) into process.env so the dev API middleware + provider
  // can read TAVILY_API_KEY / SEARCH_PROVIDER. Server-side only.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.TAVILY_API_KEY) process.env.TAVILY_API_KEY = env.TAVILY_API_KEY
  if (env.SEARCH_PROVIDER) process.env.SEARCH_PROVIDER = env.SEARCH_PROVIDER

  return {
    // Vercel serves at the domain root.
    base: '/',
    plugins: [react(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: false,
    },
    build: {
      // The Persona Lab lazy-loads Recharts, so it lands in its own async chunk
      // and is never in the initial bundle. That chunk is still a chunky vendor
      // viz lib, so lift the warning threshold for it specifically.
      chunkSizeWarningLimit: 700,
    },
  }
})
