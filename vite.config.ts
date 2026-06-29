import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3001,
    // The SPA only ever talks to the loupe API, never the browser-CORS upstreams.
    proxy: { '/v1': 'http://localhost:8787' },
  },
  test: {
    // jsdom serves both the DOM component tests (*.test.tsx) and the node/fs tests (*.test.ts)
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Gate only the deterministic request-time logic. The node-only build/fetch layer
      // (resolveDrug, http, sourcefetch/*) runs against the live network in `npm run prefetch`,
      // not in unit tests — measuring it here would punish a by-design boundary.
      include: [
        'src/core/derive.ts',
        'src/core/ndc.ts',
        'src/core/query.ts',
        'src/core/service.ts',
        'src/core/errors.ts',
        'src/lib/costRamp.ts',
        'src/lib/money.ts',
      ],
      reporter: ['text', 'html'],
      // floors sit just under current coverage so a regression trips CI, not today's run
      thresholds: { statements: 85, branches: 78, functions: 78, lines: 88 },
    },
  },
})
