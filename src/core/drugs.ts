// The curated seed registry (SPEC §3.2). The slug list IS the registry: it drives
// prefetch, the ?drug= enum, llms.txt, navigator.json, and the MCP list_drugs tool.
//
// PROVENANCE / SOURCES:
//   ingredient_rxcui — RxNorm IN; the addressing key for class + label resolution.
//   atc              — RxClass ATC 4th-level; drives the same-class alternatives lookup.
//   maintenance      — the SPL-cited maintenance dose, the ONLY input to the est. $/mo
//                      Derived value (SPEC §3.6).
//
// CI gate: `scripts/verify-seed.ts` (run by `npm run verify` in CI — see .github/workflows)
// re-resolves every ingredient_rxcui against RxNorm and confirms openFDA has a label for
// each drug, and `scripts/resolve-datasets.ts` confirms the pinned CMS dataset ids still
// return rows. CI fails on drift. (These run in CI, not the offline image build, which is
// deterministic from committed snapshots.)

export interface SeedDrug {
  slug: string // '<ingredient>-<brand>' or bare ingredient for generics
  ingredient: string // RxNorm IN name, lowercase
  ingredient_rxcui: string // verified by scripts/verify-seed.ts
  brand: string // 'Ozempic'; '' for generic
  marketed_for: string // descriptive label, NOT an approval claim
  atc: { code: string; name: string } // ATC 5th-level code; verify-seed re-resolves the 4th-level class
  /** SPL-cited maintenance dose, the ONLY input to the est. $/mo Derived value (§3.6). */
  maintenance: { dose: string; per_days: number; spl_cited: true } | null
}

export const DRUGS: SeedDrug[] = [
  {
    slug: 'semaglutide-ozempic',
    ingredient: 'semaglutide',
    ingredient_rxcui: '1991302',
    brand: 'Ozempic',
    marketed_for: 'type 2 diabetes',
    atc: { code: 'A10BJ06', name: 'Glucagon-like peptide-1 (GLP-1) analogues' },
    maintenance: { dose: '1 mg', per_days: 7, spl_cited: true },
  },
  {
    slug: 'semaglutide-wegovy',
    ingredient: 'semaglutide',
    ingredient_rxcui: '1991302',
    brand: 'Wegovy',
    marketed_for: 'chronic weight management',
    atc: { code: 'A10BJ06', name: 'Glucagon-like peptide-1 (GLP-1) analogues' },
    maintenance: { dose: '2.4 mg', per_days: 7, spl_cited: true },
  },
  {
    slug: 'semaglutide-rybelsus',
    ingredient: 'semaglutide',
    ingredient_rxcui: '1991302',
    brand: 'Rybelsus',
    marketed_for: 'type 2 diabetes (oral)',
    atc: { code: 'A10BJ06', name: 'Glucagon-like peptide-1 (GLP-1) analogues' },
    maintenance: { dose: '14 mg', per_days: 1, spl_cited: true },
  },
  {
    slug: 'tirzepatide-mounjaro',
    ingredient: 'tirzepatide',
    ingredient_rxcui: '2601723',
    brand: 'Mounjaro',
    marketed_for: 'type 2 diabetes',
    atc: { code: 'A10BX16', name: 'Tirzepatide' },
    maintenance: { dose: '10 mg', per_days: 7, spl_cited: true },
  },
  {
    slug: 'tirzepatide-zepbound',
    ingredient: 'tirzepatide',
    ingredient_rxcui: '2601723',
    brand: 'Zepbound',
    marketed_for: 'chronic weight management',
    atc: { code: 'A10BX16', name: 'Tirzepatide' },
    maintenance: { dose: '10 mg', per_days: 7, spl_cited: true },
  },
  {
    slug: 'dulaglutide-trulicity',
    ingredient: 'dulaglutide',
    ingredient_rxcui: '1551291',
    brand: 'Trulicity',
    marketed_for: 'type 2 diabetes',
    atc: { code: 'A10BJ05', name: 'Dulaglutide' },
    maintenance: { dose: '1.5 mg', per_days: 7, spl_cited: true },
  },
  {
    slug: 'liraglutide-victoza',
    ingredient: 'liraglutide',
    ingredient_rxcui: '475968',
    brand: 'Victoza',
    marketed_for: 'type 2 diabetes',
    atc: { code: 'A10BJ02', name: 'Liraglutide' },
    maintenance: { dose: '1.8 mg', per_days: 1, spl_cited: true },
  },
  {
    slug: 'liraglutide-saxenda',
    ingredient: 'liraglutide',
    ingredient_rxcui: '475968',
    brand: 'Saxenda',
    marketed_for: 'chronic weight management',
    atc: { code: 'A10BJ02', name: 'Liraglutide' },
    maintenance: { dose: '3 mg', per_days: 1, spl_cited: true },
  },
  {
    slug: 'empagliflozin-jardiance',
    ingredient: 'empagliflozin',
    ingredient_rxcui: '1545653',
    brand: 'Jardiance',
    marketed_for: 'type 2 diabetes / cardiovascular',
    atc: { code: 'A10BK03', name: 'Empagliflozin' },
    maintenance: { dose: '10 mg', per_days: 1, spl_cited: true },
  },
  {
    slug: 'dapagliflozin-farxiga',
    ingredient: 'dapagliflozin',
    ingredient_rxcui: '1488564',
    brand: 'Farxiga',
    marketed_for: 'type 2 diabetes / chronic kidney disease',
    atc: { code: 'A10BK01', name: 'Dapagliflozin' },
    maintenance: { dose: '10 mg', per_days: 1, spl_cited: true },
  },
  {
    slug: 'metformin',
    ingredient: 'metformin',
    ingredient_rxcui: '6809',
    brand: '',
    marketed_for: 'type 2 diabetes (generic anchor)',
    atc: { code: 'A10BA02', name: 'Metformin' },
    maintenance: null,
  },
  {
    slug: 'atorvastatin',
    ingredient: 'atorvastatin',
    ingredient_rxcui: '83367',
    brand: '',
    marketed_for: 'high cholesterol (generic anchor)',
    atc: { code: 'C10AA05', name: 'Atorvastatin' },
    maintenance: null,
  },
]

export const DRUG_BY_SLUG: Record<string, SeedDrug> = Object.fromEntries(
  DRUGS.map((d) => [d.slug, d]),
)

/** Display label for a seed drug: "Ozempic" for brands, "metformin" for generics. */
export function drugLabel(d: SeedDrug): string {
  return d.brand || d.ingredient
}
