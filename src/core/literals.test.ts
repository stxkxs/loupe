import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Drug } from '@/core/schema'

// MUST-FIX invariant: committed snapshots OMIT every guardrail literal, so a snapshot can
// never ship a stale/edited disclaimer. Drug.parse() back-fills them on read.
const DIR = resolve(process.cwd(), 'src/data/snapshot')
const LITERALS = [
  'NADAC acquisition, not patient copay',
  'Cost ≠ copay',
  'not incidence rates',
  'quoted verbatim from the FDA',
  'never advises a switch',
  'Not medical advice',
]

describe('snapshots omit guardrail literals', () => {
  const files = existsSync(DIR)
    ? readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
    : []

  it('snapshots exist (run `npm run prefetch`)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const f of files) {
    it(`${f}: no literal in file, parses, and parse() fills the guardrails`, () => {
      const raw = readFileSync(`${DIR}/${f}`, 'utf8')
      for (const lit of LITERALS) expect(raw).not.toContain(lit)
      const drug = Drug.parse(JSON.parse(raw))
      expect(drug.cost.cost_basis).toContain('NADAC')
      expect(drug.label.faers_disclaimer).toContain('not incidence rates')
      expect(drug.alternatives.clinician_gate).toContain('never advises a switch')
      expect(drug.meta.disclaimer).toContain('Not medical advice')
    })
  }
})
