import { describe, it, expect } from 'vitest'
import { app } from './app'

// In-process integration over the Hono app (no network) — exercises the public /v1 contract:
// the seam where the SPA, agents, and the OpenAPI doc all meet the DrugService.
describe('GET /v1 API', () => {
  it('lists drug summaries', async () => {
    const res = await app.request('/v1/drugs?limit=3')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { count: number; results: { drug_id: string }[] }
    expect(body.count).toBe(3)
    expect(body.results[0]).toHaveProperty('drug_id')
  })

  it('returns the full Drug with its cost_basis guardrail', async () => {
    const res = await app.request('/v1/drugs/tirzepatide-zepbound')
    expect(res.status).toBe(200)
    const drug = (await res.json()) as { cost: { cost_basis: string } }
    expect(drug.cost.cost_basis).toContain('NADAC')
  })

  it('returns a single panel', async () => {
    const res = await app.request('/v1/drugs/metformin/shortage')
    expect(res.status).toBe(200)
    expect((await res.json()) as { status: string }).toHaveProperty('status')
  })

  it('404s an unknown drug with the error envelope', async () => {
    const res = await app.request('/v1/drugs/nope')
    expect(res.status).toBe(404)
    expect((await res.json()) as { error: string }).toMatchObject({ error: 'not_found' })
  })

  it('400s an invalid panel', async () => {
    const res = await app.request('/v1/drugs/metformin/bogus')
    expect(res.status).toBe(400)
  })

  it('400s a missing search query', async () => {
    expect((await app.request('/v1/search')).status).toBe(400)
  })

  it('400s a non-numeric limit (no silent NaN coercion)', async () => {
    expect((await app.request('/v1/drugs?limit=abc')).status).toBe(400)
  })

  it('search finds by brand', async () => {
    const res = await app.request('/v1/search?q=wegovy')
    const body = (await res.json()) as { results: { drug_id: string }[] }
    expect(body.results.map((r) => r.drug_id)).toContain('semaglutide-wegovy')
  })

  it('serves a generated OpenAPI doc', async () => {
    const res = await app.request('/openapi.json')
    expect(res.status).toBe(200)
    const doc = (await res.json()) as { openapi: string; components: { schemas: Record<string, unknown> } }
    expect(doc.openapi).toBe('3.0.3')
    expect(doc.components.schemas).toHaveProperty('Drug')
  })
})
