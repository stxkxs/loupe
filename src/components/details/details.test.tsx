import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Drug } from '@/core/schema'
import { DrugHero } from '@/components/DrugHero'
import { CostDetail } from '@/components/details/CostDetail'
import { SupplyDetail } from '@/components/details/SupplyDetail'
import { LabelDetail } from '@/components/details/LabelDetail'
import { AlternativesDetail } from '@/components/details/AlternativesDetail'

const load = (slug: string): Drug =>
  Drug.parse(JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/snapshot', `${slug}.json`), 'utf8')))

afterEach(cleanup)

// Guardrails must be RENDERED, not just typed (SPEC §6.2). After the spotlight rework the
// long legal text moved into InfoTip tooltips (still in the a11y tree), so each panel ALSO
// carries a short, always-visible proxy line. These tests assert BOTH: the visible proxy and
// the verbatim tooltip literal — so a refactor that drops the on-screen framing fails here.
describe('overview + detail views render the guardrails', () => {
  it('DrugHero: FDA-approved status shown as text (not color-only)', () => {
    render(<DrugHero drug={load('tirzepatide-zepbound')} onSources={() => {}} />)
    expect(screen.getByText(/FDA-approved/i)).toBeTruthy()
  })

  it('CostDetail: visible "not your copay" proxy + verbatim "Cost ≠ copay" tooltip', () => {
    render(<CostDetail drug={load('tirzepatide-zepbound')} />)
    expect(screen.getByText(/acquisition cost, not your copay/i)).toBeTruthy() // visible proxy
    expect(screen.getByText(/Cost ≠ copay/i)).toBeTruthy() // tooltip literal
    expect(screen.getByText(/acquisition cost \/ package/i)).toBeTruthy()
  })

  it('SupplyDetail: status text label + visible "your pharmacy may differ" proxy', () => {
    render(<SupplyDetail drug={load('semaglutide-rybelsus')} />)
    expect(screen.getAllByText(/Discontinued/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/FDA national status — your pharmacy may differ/i)).toBeTruthy() // visible proxy
  })

  it('LabelDetail: visible "not incidence rates" proxy on the FAERS chart', () => {
    render(<LabelDetail drug={load('tirzepatide-zepbound')} />)
    expect(screen.getByText(/spontaneous reports — not incidence rates/i)).toBeTruthy() // visible proxy
  })

  it('AlternativesDetail: visible "discuss with your care team" proxy + clinician-gate tooltip', () => {
    render(<AlternativesDetail drug={load('atorvastatin')} onPick={() => {}} />)
    expect(screen.getByText(/discuss any change with your care team/i)).toBeTruthy() // visible proxy
    expect(screen.getByText(/never advises a switch/i)).toBeTruthy() // tooltip literal
  })
})
