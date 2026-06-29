import { z } from 'zod'
import { CacheState, Provenance } from './provenance'
import { GUARDRAILS } from './guardrails'

/**
 * THE canonical Drug contract (SPEC §4.2) — the single source of truth parsed by
 * the data builder, serialized verbatim by the Hono read-API, returned byte-for-byte
 * by the MCP tools, used to type the React panels, and used to generate /openapi.json.
 *
 * Guardrail strings are `z.literal(...).default(...)`. The prefetch snapshot store
 * OMITS them; `Drug.parse()` back-fills them, so every serialized object always
 * carries the guardrail and it appears as a `const` in /openapi.json + MCP outputSchema.
 *
 * MUST-FIX honored: `z.literal().default()` only fills `undefined` — it does NOT
 * coerce a present-but-different value (that THROWS). Therefore snapshot JSON must
 * OMIT all guardrail literals; `literals.test.ts` asserts this.
 */

// ── Status enums — reduced to what sources actually provide (must-fix) ──
//   approved  = an SPL exists in openFDA.  black-box = structured boxed_warning present.
//   off-label / withdrawn / investigational are RESERVED, never emitted in v1 (no source).
export const ApprovalStatus = z.enum([
  'approved',
  'black-box',
  'off-label',
  'withdrawn',
  'investigational',
])
export type ApprovalStatus = z.infer<typeof ApprovalStatus>

export const ShortageStatus = z.enum([
  'available',
  'limited',
  'in-shortage',
  'discontinued',
  'resolved',
])
export type ShortageStatus = z.infer<typeof ShortageStatus>

// ── Panel 1: Identity / class ──
export const DrugClass = z.object({
  class_id: z.string(),
  class_name: z.string(),
  class_type: z.enum(['ATC1-4', 'MOA', 'EPC', 'PE', 'CHEM']),
  rela_source: z.string().nullable(),
})
export type DrugClass = z.infer<typeof DrugClass>

export const Identity = z.object({
  brand_name: z.string(),
  generic_name: z.string(),
  rxcui: z.string(),
  manufacturer: z.string().nullable(),
  approval_status: ApprovalStatus, // only 'approved' emitted in v1
  has_boxed_warning: z.boolean(), // structured boxed_warning present
  classes: z.array(DrugClass),
  routes: z.array(z.string()),
  strengths: z.array(z.string()),
  provenance: z.array(Provenance), // rxnorm + rxclass + ndc + label
})
export type Identity = z.infer<typeof Identity>

// ── Panel 2: Cost reality ──
export const CostPoint = z.object({
  ndc11: z.string(),
  description: z.string(),
  nadac_per_unit_usd: z.number().nullable(),
  pricing_unit: z.string().nullable(), // ML | EA | GM
  units_per_package: z.number().nullable(),
  est_package_cost_usd: z.number().nullable(), // FACTUAL: per_unit × units_per_package
  est_monthly_cost_usd: z.number().nullable(), // DERIVED/est. — null unless SPL maintenance dose exists
  est_monthly_method: z.string().nullable(), // the Derived<T>.method string, when est_monthly present
  effective_date: z.iso.date().nullable(),
  provenance: Provenance, // nadac
})
export type CostPoint = z.infer<typeof CostPoint>

export const MedicareSpend = z.object({
  total_spending_usd: z.number().nullable(),
  total_claims: z.number().nullable(),
  avg_spend_per_claim_usd: z.number().nullable(),
  year: z.number().nullable(),
  provenance: Provenance, // medicare_partd — context line, never a patient price
})
export type MedicareSpend = z.infer<typeof MedicareSpend>

export const Cost = z.object({
  cost_basis: z.literal(GUARDRAILS.costBasis).default(GUARDRAILS.costBasis),
  disclaimer: z.literal(GUARDRAILS.costDisclaimer).default(GUARDRAILS.costDisclaimer),
  points: z.array(CostPoint),
  package_low_usd: z.number().nullable(),
  package_high_usd: z.number().nullable(),
  medicare_context: MedicareSpend.nullable(),
  coverage_note: z.string().nullable(), // empty-state, NOT a fake price
  provenance: z.array(Provenance),
})
export type Cost = z.infer<typeof Cost>

// ── Panel 3: Live supply ──
export const Shortage = z.object({
  status: ShortageStatus,
  reason: z.string().nullable(), // VERBATIM reason_for_shortage
  resupply_estimate: z.string().nullable(), // VERBATIM availability_information
  presentations_affected: z.array(z.string()),
  initial_posting_date: z.iso.date().nullable(),
  update_date: z.iso.date().nullable(),
  disclaimer: z.literal(GUARDRAILS.shortageDisclaimer).default(GUARDRAILS.shortageDisclaimer),
  provenance: Provenance, // openfda_shortages
})
export type Shortage = z.infer<typeof Shortage>

// ── Panel 4: Label facts (verbatim) ──
export const LabelQuote = z.object({
  section: z.enum([
    'boxed_warning',
    'dosage_and_administration',
    'adverse_reactions',
    'indications_and_usage',
    'warnings',
  ]),
  text: z.string(), // VERBATIM whole-section SPL text
  highlight: z.string().nullable(), // a sentence to EMPHASIZE in place — never extracted alone
  truncated: z.boolean(),
})
export type LabelQuote = z.infer<typeof LabelQuote>

export const FaersReaction = z.object({
  reaction: z.string(), // MedDRA PT
  report_count: z.number(),
})
export type FaersReaction = z.infer<typeof FaersReaction>

export const Label = z.object({
  setid: z.string(),
  spl_version: z.string().nullable(),
  effective_time: z.iso.date().nullable(),
  dailymed_url: z.url(),
  quotes: z.array(LabelQuote),
  faers_total_reports: z.number().nullable(),
  faers_top_reactions: z.array(FaersReaction),
  faers_query: z.string(), // the exact search= the counts cover
  faers_disclaimer: z.literal(GUARDRAILS.faersDisclaimer).default(GUARDRAILS.faersDisclaimer),
  label_disclaimer: z.literal(GUARDRAILS.labelDisclaimer).default(GUARDRAILS.labelDisclaimer),
  provenance: z.array(Provenance), // openfda_label + dailymed + openfda_faers
})
export type Label = z.infer<typeof Label>

// ── Panel 5: Same-class alternatives (clinician-gated) ──
export const Alternative = z.object({
  drug_id: z.string().nullable(), // slug if in registry, else null
  brand_name: z.string(),
  generic_name: z.string(),
  rxcui: z.string(),
  shared_class: z.string(),
  shared_class_type: z.string(),
  in_registry: z.boolean(),
  provenance: Provenance, // rxclass
})
export type Alternative = z.infer<typeof Alternative>

export const Alternatives = z.object({
  basis: z.literal(GUARDRAILS.alternativesBasis).default(GUARDRAILS.alternativesBasis),
  clinician_gate: z.literal(GUARDRAILS.clinicianGate).default(GUARDRAILS.clinicianGate),
  same_class: z.array(Alternative),
  provenance: z.array(Provenance),
})
export type Alternatives = z.infer<typeof Alternatives>

// ── The canonical record ──
export const DrugMeta = z.object({
  generated_at: z.iso.datetime(),
  freshness: CacheState,
  disclaimer: z.literal(GUARDRAILS.notMedicalAdvice).default(GUARDRAILS.notMedicalAdvice),
  sources: z.array(Provenance), // flattened union
})
export type DrugMeta = z.infer<typeof DrugMeta>

export const Drug = z.object({
  drug_id: z.string(),
  schema_version: z.literal('1').default('1'),
  identity: Identity,
  cost: Cost,
  shortage: Shortage,
  label: Label,
  alternatives: Alternatives,
  meta: DrugMeta,
})
export type Drug = z.infer<typeof Drug>

export const DrugSummary = z.object({
  drug_id: z.string(),
  brand_name: z.string(),
  generic_name: z.string(),
  rxcui: z.string(),
  primary_class: z.string().nullable(),
  approval_status: ApprovalStatus,
  shortage_status: ShortageStatus.nullable(),
  est_package_cost_usd: z.number().nullable(), // FACTUAL package cost (not derived $/mo)
})
export type DrugSummary = z.infer<typeof DrugSummary>

/** The drug-record panels, in render order — the single source for every panel-key list. */
export const PANELS = ['identity', 'cost', 'shortage', 'label', 'alternatives'] as const
export type PanelKey = (typeof PANELS)[number]
