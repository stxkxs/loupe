import { describe, it, expect } from 'vitest'
import { Drug } from '@/core/schema'
import type { Provenance } from '@/core/provenance'

// One provenance stamp reused across the fixture.
const prov: Provenance = {
  source: 'openfda_label',
  source_label: 'openFDA Drug Label (SPL)',
  source_url: 'https://api.fda.gov/drug/label.json?search=openfda.generic_name:semaglutide',
  retrieved_at: '2026-06-28T00:00:00.000Z',
  as_of: '2026-06-26',
  cache: 'cached',
  record_id: 'setid-abc',
}

/**
 * A snapshot-shaped Drug input that OMITS every guardrail literal (cost_basis,
 * disclaimer, faers_disclaimer, label_disclaimer, basis, clinician_gate,
 * meta.disclaimer, schema_version). `Drug.parse()` must back-fill them all.
 */
function fixture(): unknown {
  return {
    drug_id: 'semaglutide-ozempic',
    identity: {
      brand_name: 'Ozempic',
      generic_name: 'semaglutide',
      rxcui: '1991302',
      manufacturer: 'Novo Nordisk',
      approval_status: 'approved',
      has_boxed_warning: false,
      classes: [
        { class_id: 'A10BJ06', class_name: 'GLP-1 analogues', class_type: 'ATC1-4', rela_source: 'ATC' },
      ],
      routes: ['SUBCUTANEOUS'],
      strengths: ['0.5 mg/dose', '1 mg/dose'],
      provenance: [prov],
    },
    cost: {
      points: [
        {
          ndc11: '00169413211',
          description: 'Ozempic 1 mg pen',
          nadac_per_unit_usd: 270.62,
          pricing_unit: 'ML',
          units_per_package: 3,
          est_package_cost_usd: 811.86,
          est_monthly_cost_usd: null,
          est_monthly_method: null,
          effective_date: '2026-06-26',
          provenance: prov,
        },
      ],
      package_low_usd: 811.86,
      package_high_usd: 1087.0,
      medicare_context: null,
      coverage_note: null,
      provenance: [prov],
    },
    shortage: {
      status: 'available',
      reason: null,
      resupply_estimate: null,
      presentations_affected: [],
      initial_posting_date: null,
      update_date: '2026-06-27',
      provenance: prov,
    },
    label: {
      setid: 'abc',
      spl_version: '12',
      effective_time: '2026-03-01',
      dailymed_url: 'https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=abc',
      quotes: [
        { section: 'dosage_and_administration', text: 'Administer once weekly.', highlight: null, truncated: false },
      ],
      faers_total_reports: 1000,
      faers_top_reactions: [{ reaction: 'NAUSEA', report_count: 120 }],
      faers_query: 'patient.drug.openfda.generic_name:semaglutide',
      provenance: [prov],
    },
    alternatives: {
      same_class: [
        {
          drug_id: 'tirzepatide-mounjaro',
          brand_name: 'Mounjaro',
          generic_name: 'tirzepatide',
          rxcui: '2601723',
          shared_class: 'GLP-1 Receptor Agonist',
          shared_class_type: 'EPC',
          in_registry: true,
          provenance: prov,
        },
      ],
      provenance: [prov],
    },
    meta: {
      generated_at: '2026-06-28T00:00:00.000Z',
      freshness: 'cached',
      sources: [prov],
    },
  }
}

describe('Drug contract', () => {
  it('parses a snapshot fixture and back-fills every guardrail default', () => {
    const drug = Drug.parse(fixture())

    expect(drug.schema_version).toBe('1')
    expect(drug.cost.cost_basis).toBe('NADAC acquisition, not patient copay')
    expect(drug.cost.disclaimer).toContain('Cost ≠ copay')
    expect(drug.label.faers_disclaimer).toContain('not incidence rates')
    expect(drug.label.label_disclaimer).toContain('verbatim')
    expect(drug.alternatives.clinician_gate).toContain('never advises a switch')
    expect(drug.alternatives.basis).toContain('Informational only')
    expect(drug.meta.disclaimer).toContain('Not medical advice')
  })

  it('THROWS when a stored object carries a wrong guardrail literal (must-fix: defaults do not heal)', () => {
    const tampered = fixture() as Record<string, unknown>
    ;(tampered.cost as Record<string, unknown>).cost_basis = 'whatever the marketing team wants'
    expect(() => Drug.parse(tampered)).toThrow()
  })
})
