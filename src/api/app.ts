import { existsSync } from 'node:fs'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from '@hono/node-server/serve-static'
import { Drug, PANELS } from '../core/schema'
import { GUARDRAILS } from '../core/guardrails'
import * as svc from '../core/service'
import { LoupeError } from '../core/errors'
import { listQuery, searchQuery } from './validate'
import { openapiDoc } from './openapi'
import { docsHtml } from './docs'

const DISCLAIMER = GUARDRAILS.notMedicalAdvice
const HAS_SPA = existsSync('./dist/index.html')

export const app = new Hono()

// keyless read API — open CORS so agents can call it from anywhere
app.use('/*', cors({ origin: '*', allowMethods: ['GET'] }))
app.use('/*', logger())

// nothing should 500 silently — log it and return the error envelope
app.onError((err, c) => {
  console.error('[loupe-api]', err)
  return c.json({ error: 'internal', message: 'internal error' }, 500)
})

app.get('/health', (c) => c.json({ ok: true, drugs: svc.allSlugs().length }))
app.get('/api', (c) =>
  c.json({ service: 'loupe', version: '1', api: '/v1', openapi: '/openapi.json', docs: '/docs', mcp: 'stdio', disclaimer: DISCLAIMER }),
)
app.get('/openapi.json', (c) => c.json(openapiDoc()))
app.get('/docs', (c) => c.html(docsHtml()))

app.get('/v1/drugs', (c) => {
  const parsed = listQuery.safeParse(c.req.query())
  if (!parsed.success) {
    const e = new LoupeError('bad_request', parsed.error.issues[0]?.message ?? 'invalid query', 400).toHttp()
    return c.json(e.body, 400)
  }
  return c.json(svc.listDrugs(parsed.data))
})

app.get('/v1/search', (c) => {
  const parsed = searchQuery.safeParse(c.req.query())
  if (!parsed.success) {
    const e = new LoupeError('bad_request', 'query parameter "q" is required', 400).toHttp()
    return c.json(e.body, 400)
  }
  return c.json(svc.searchDrugs(parsed.data.q, parsed.data.limit))
})

app.get('/v1/drugs/:slug', (c) => {
  const drug = svc.getDrug(c.req.param('slug'))
  if (!drug) {
    const e = new LoupeError('not_found', `unknown drug_id: ${c.req.param('slug')}`, 404).toHttp()
    return c.json(e.body, 404)
  }
  return c.json(Drug.parse(drug)) // parse() back-fills the omitted guardrail literals
})

app.get('/v1/drugs/:slug/:panel', (c) => {
  const panel = c.req.param('panel')
  if (!PANELS.includes(panel as (typeof PANELS)[number])) {
    const e = new LoupeError('bad_request', `panel must be one of ${PANELS.join('|')}`, 400).toHttp()
    return c.json(e.body, 400)
  }
  const data = svc.getPanel(c.req.param('slug'), panel as svc.PanelName)
  if (!data) {
    const e = new LoupeError('not_found', `unknown drug_id: ${c.req.param('slug')}`, 404).toHttp()
    return c.json(e.body, 404)
  }
  return c.json(data)
})

// One process serves both faces: the static SPA (which bundles its own catalog) and the
// /v1 API. If the SPA hasn't been built, expose the service index at / instead.
if (HAS_SPA) {
  app.use('/assets/*', serveStatic({ root: './dist' }))
  app.use('/.well-known/*', serveStatic({ root: './dist' }))
  app.get('/llms.txt', serveStatic({ path: './dist/llms.txt' }))
  app.get('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }))
  app.get('*', serveStatic({ path: './dist/index.html' })) // SPA fallback
} else {
  app.get('/', (c) =>
    c.json({ service: 'loupe', version: '1', spa: 'run `npm run build`', api: '/v1', docs: '/docs', disclaimer: DISCLAIMER }),
  )
}
