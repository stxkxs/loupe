import { describe, it, expect } from 'vitest'
import { listDrugs, searchDrugs, getDrug, getPanel, toSummary, allSlugs } from '@/core/service'

describe('DrugService over the snapshot catalog', () => {
  it('lists the whole registry', () => {
    expect(listDrugs().count).toBe(12)
    expect(allSlugs().length).toBe(12)
  })

  it('filters by shortage status', () => {
    const r = listDrugs({ shortage: 'discontinued' })
    expect(r.count).toBeGreaterThan(0)
    expect(r.results.every((s) => s.shortage_status === 'discontinued')).toBe(true)
  })

  it('sorts cheapest-first by cost (generics lead)', () => {
    const r = listDrugs({ sort: 'cost' })
    expect(['atorvastatin', 'metformin']).toContain(r.results[0].drug_id)
  })

  it('respects limit', () => {
    expect(listDrugs({ limit: 3 }).results.length).toBe(3)
  })

  it('search matches brand + generic', () => {
    expect(searchDrugs('semaglutide').results.length).toBeGreaterThanOrEqual(3)
    expect(searchDrugs('wegovy').results.map((s) => s.drug_id)).toContain('semaglutide-wegovy')
  })

  it('getPanel returns the panel sub-object with its guardrail', () => {
    const cost = getPanel('tirzepatide-zepbound', 'cost') as { cost_basis: string }
    expect(cost.cost_basis).toContain('NADAC')
  })

  it('unknown drug → null', () => {
    expect(getDrug('nope')).toBeNull()
    expect(getPanel('nope', 'cost')).toBeNull()
  })

  it('summary primary_class prefers EPC/ATC class name', () => {
    const d = getDrug('semaglutide-wegovy')
    expect(d).not.toBeNull()
    expect(toSummary(d!).primary_class).toBeTruthy()
  })
})
