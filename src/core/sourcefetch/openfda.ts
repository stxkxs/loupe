// openFDA fetchers: NDC directory, drug label (SPL), drug shortages, FAERS counts.
// Each returns the EXACT query URL it used, so resolveDrug can stamp provenance.

import { getJsonOrNull } from '../http'
import { to11 } from '../ndc'
import { mdyToEpoch } from '../dates'

const FDA = 'https://api.fda.gov/drug'
const quote = (s: string) => encodeURIComponent(`"${s}"`)

interface OpenFdaResp {
  results?: Record<string, unknown>[]
  meta?: { results?: { total?: number }; last_updated?: string }
}

// ── NDC directory ──
export interface NdcResult {
  url: string
  manufacturer: string | null
  routes: string[]
  strengths: string[]
  dosage_forms: string[]
  packages: { ndc11: string; description: string }[]
}

export async function fetchNdc(opts: { brand?: string; generic: string }): Promise<NdcResult | null> {
  const term = opts.brand ? `brand_name:${quote(opts.brand)}` : `generic_name:${quote(opts.generic)}`
  const url = `${FDA}/ndc.json?search=${term}&limit=50`
  const data = await getJsonOrNull<OpenFdaResp>(url)
  if (!data?.results?.length) return null

  const routes = new Set<string>()
  const strengths = new Set<string>()
  const forms = new Set<string>()
  const packages = new Map<string, string>()
  let manufacturer: string | null = null

  for (const r of data.results) {
    const openfda = (r.openfda ?? {}) as Record<string, string[]>
    manufacturer ??= (r.labeler_name as string) ?? openfda.manufacturer_name?.[0] ?? null
    const route = r.route
    for (const rt of Array.isArray(route) ? route : route ? [route as string] : []) routes.add(rt)
    if (r.dosage_form) forms.add(r.dosage_form as string)
    for (const ai of (r.active_ingredients as { strength?: string }[]) ?? [])
      if (ai.strength) strengths.add(ai.strength)
    for (const p of (r.packaging as { package_ndc?: string; description?: string }[]) ?? []) {
      const n = p.package_ndc ? to11(p.package_ndc) : null
      if (n) packages.set(n, p.description ?? '')
    }
  }

  return {
    url,
    manufacturer,
    routes: [...routes],
    strengths: [...strengths].slice(0, 12),
    dosage_forms: [...forms],
    packages: [...packages].map(([ndc11, description]) => ({ ndc11, description })),
  }
}

// ── Drug label (SPL) ──
export type LabelSection =
  | 'boxed_warning'
  | 'dosage_and_administration'
  | 'adverse_reactions'
  | 'indications_and_usage'
  | 'warnings_and_cautions'
  | 'warnings'

export interface LabelResult {
  url: string
  setid: string | null
  effective_time: string | null // raw YYYYMMDD
  has_boxed_warning: boolean
  manufacturer: string | null
  routes: string[]
  sections: Partial<Record<LabelSection, string>>
}

export async function fetchLabel(opts: { brand?: string; generic: string }): Promise<LabelResult | null> {
  const term = opts.brand
    ? `openfda.brand_name:${quote(opts.brand)}`
    : `openfda.generic_name:${quote(opts.generic)}`
  const url = `${FDA}/label.json?search=${term}&limit=1`
  const data = await getJsonOrNull<OpenFdaResp>(url)
  const r = data?.results?.[0]
  if (!r) return null

  const join = (k: string): string | undefined => {
    const v = r[k]
    return Array.isArray(v) ? (v as string[]).join('\n\n') : ((v as string) ?? undefined)
  }
  const openfda = (r.openfda ?? {}) as Record<string, string[]>
  const sections: Partial<Record<LabelSection, string>> = {}
  for (const s of [
    'boxed_warning',
    'dosage_and_administration',
    'adverse_reactions',
    'indications_and_usage',
    'warnings_and_cautions',
    'warnings',
  ] as LabelSection[]) {
    const v = join(s)
    if (v) sections[s] = v
  }

  return {
    url,
    setid: (r.set_id as string) ?? null,
    effective_time: (r.effective_time as string) ?? null,
    has_boxed_warning: Array.isArray(r.boxed_warning) && (r.boxed_warning as string[]).length > 0,
    manufacturer: openfda.manufacturer_name?.[0] ?? null,
    routes: openfda.route ?? [],
    sections,
  }
}

// ── Drug shortages ──
export interface ShortageResult {
  url: string
  status: string
  reason: string | null
  availability: string | null
  presentations: string[]
  initial_posting_date: string | null // raw MM/DD/YYYY
  update_date: string | null
  package_ndcs: string[]
}

export async function fetchShortage(opts: { brand?: string; generic: string }): Promise<ShortageResult | null> {
  const url = `${FDA}/shortages.json?search=openfda.generic_name:${quote(opts.generic)}&limit=20`
  const data = await getJsonOrNull<OpenFdaResp>(url)
  if (!data?.results?.length) return null

  // Brand pages must only reflect THEIR brand's records — a Rybelsus discontinuation
  // is not an Ozempic shortage. If a brand has no matching record, it isn't in shortage.
  let results = data.results
  if (opts.brand) {
    const b = opts.brand.toLowerCase()
    results = results.filter((r) => {
      const brands = ((r.openfda as Record<string, string[]>)?.brand_name ?? []) as string[]
      const presentation = ((r.presentation as string) ?? '').toLowerCase()
      return brands.some((x) => x.toLowerCase().includes(b)) || presentation.includes(b)
    })
  }
  if (!results.length) return null

  const sorted = [...results].sort(
    (a, b) => mdyToEpoch(b.update_date as string) - mdyToEpoch(a.update_date as string),
  )
  const r = sorted[0]
  return {
    url,
    status: (r.status as string) ?? 'unknown',
    reason: (r.reason_for_shortage as string) ?? null,
    availability: (r.availability as string) ?? null,
    presentations: sorted.map((x) => x.presentation as string).filter(Boolean).slice(0, 8),
    initial_posting_date: (r.initial_posting_date as string) ?? null,
    update_date: (r.update_date as string) ?? null,
    package_ndcs: sorted.map((x) => x.package_ndc as string).filter(Boolean),
  }
}

// ── FAERS adverse-event counts (REPORTS, not rates) ──
export interface FaersResult {
  url: string
  query: string
  total: number | null
  top: { reaction: string; report_count: number }[]
}

export async function fetchFaers(opts: { brand?: string; generic: string }): Promise<FaersResult | null> {
  const field = opts.brand
    ? 'patient.drug.openfda.brand_name.exact'
    : 'patient.drug.openfda.generic_name.exact'
  const value = (opts.brand ?? opts.generic).toUpperCase()
  const query = `${field}:"${value}"`
  const url = `${FDA}/event.json?search=${encodeURIComponent(query)}&count=patient.reaction.reactionmeddrapt.exact&limit=10`
  const counts = await getJsonOrNull<{ results?: { term: string; count: number }[] }>(url)
  if (!counts?.results?.length) return null
  const totalData = await getJsonOrNull<OpenFdaResp>(
    `${FDA}/event.json?search=${encodeURIComponent(query)}&limit=1`,
  )
  return {
    url,
    query,
    total: totalData?.meta?.results?.total ?? null,
    top: counts.results.map((c) => ({ reaction: c.term, report_count: c.count })),
  }
}
