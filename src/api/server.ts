import { serve } from '@hono/node-server'
import { app } from './app'
import { warmCatalog } from '../core/service'

const port = Number(process.env.PORT ?? 8787)
const drugs = warmCatalog() // validate every snapshot before accepting traffic

const server = serve({ fetch: app.fetch, port })
console.log(`loupe api → http://localhost:${port}  (${drugs} drugs · docs: /docs · openapi: /openapi.json)`)

// drain in-flight requests on deploy/stop instead of dropping them
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} received — draining…`)
    server.close(() => process.exit(0))
  })
}
