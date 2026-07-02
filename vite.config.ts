import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // On GitHub Pages the app is served from /ForgeEditorialLab/; dev stays at /.
  base: command === 'build' ? '/ForgeEditorialLab/' : '/',
  plugins: [react()],
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
}))
