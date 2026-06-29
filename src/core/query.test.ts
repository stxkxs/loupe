import { describe, it, expect } from 'vitest'
import { queryUrl, deepLink, toApiCall, citeSource } from '@/core/query'
import type { Provenance } from '@/core/provenance'

describe('DrugQuery → one source of truth', () => {
  it('builds /v1 API urls', () => {
    expect(queryUrl({ resource: 'cost', id: 'tirzepatide-zepbound' })).toBe(
      '/v1/drugs/tirzepatide-zepbound/cost',
    )
    expect(queryUrl({ resource: 'drugs', params: { class: 'GLP-1' } })).toBe(
      '/v1/drugs?class=GLP-1',
    )
    expect(queryUrl({ resource: 'search', params: { q: 'wegovy' } })).toBe('/v1/search?q=wegovy')
  })

  it('builds shareable deep-links to the matching panel view', () => {
    expect(deepLink({ resource: 'shortage', id: 'semaglutide-wegovy' })).toBe(
      'https://loupe.health/?drug=semaglutide-wegovy&view=supply',
    )
  })

  it('emits keyless snippets that all hit the same absolute url', () => {
    const call = toApiCall({ resource: 'drug', id: 'semaglutide-wegovy' })
    const path = '/v1/drugs/semaglutide-wegovy'
    expect(call.url).toBe(path)
    expect(call.curl).toContain(path)
    expect(call.python).toContain('requests.get')
    expect(call.ts).toContain('fetch')
    // snippets carry an absolute host even though the app talks same-origin
    expect(call.curl).toContain('https://loupe.health')
  })
})

describe('citeSource', () => {
  it('formats an APA-ish citation with the as-of stamp', () => {
    const p: Provenance = {
      source: 'nadac',
      source_label: 'CMS NADAC (acquisition cost)',
      source_url: 'https://data.medicaid.gov/api/1/datastore/query/abc/0',
      retrieved_at: '2026-06-28T12:00:00.000Z',
      as_of: '2026-06-26',
      cache: 'cached',
      record_id: 'row-1',
    }
    expect(citeSource(p).apa).toContain('CMS NADAC')
    expect(citeSource(p).apa).toContain('AS OF 2026-06-26')
    expect(citeSource(p).bibtex).toContain('@misc{nadac')
  })
})
