// The canonical guardrail strings — ONE source of truth (SPEC §guardrail creed).
// schema.ts pins these as z.literal defaults; the UI chrome, API service-index, MCP
// tool descriptions, and OpenAPI info all import them so the human-facing copy can
// never drift from the machine-read literals.
export const GUARDRAILS = {
  notMedicalAdvice:
    'Not medical advice. loupe is not affiliated with the FDA, NLM, or CMS. Drug-PRODUCT reference data only — zero PHI.',
  costBasis: 'NADAC acquisition, not patient copay',
  costDisclaimer:
    'Cost ≠ copay. NADAC is the national average price pharmacies pay to ACQUIRE the drug — not list price and not what a patient pays. Out-of-pocket depends on insurance, manufacturer savings cards, and pharmacy.',
  shortageDisclaimer:
    'Reflects the FDA Drug Shortages database as of update_date. National status — your pharmacy may differ.',
  faersDisclaimer:
    'FAERS counts are spontaneous adverse-event REPORTS, not incidence rates. A report does not establish causation; counts reflect reporting behavior and market size.',
  labelDisclaimer:
    'Label text is quoted verbatim from the FDA Structured Product Label (SPL). Not a substitute for the full prescribing information reviewed with your clinician.',
  alternativesBasis:
    'Grouped by shared pharmacologic class (RxClass ATC/MoA/EPC). Informational only.',
  clinicianGate:
    'Informational only — not a recommendation. Discuss with your care team. Do not start, stop, or switch any medication on your own. loupe never advises a switch.',
} as const
