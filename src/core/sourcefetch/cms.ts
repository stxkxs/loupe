// CMS fetchers: NADAC acquisition cost (per 11-digit NDC) and Medicare Part D
// program-spend context. Dataset ids are pinned here and re-confirmed in CI by
// scripts/resolve-datasets.ts, which fails CI if a pinned dataset stops returning rows.

import { getJsonOrNull } from '../http'

const NADAC_DATASET = 'fbb83258-11c7-47f5-8b18-5f8e79f7e704' // NADAC (National Average Drug Acquisition Cost)
const PARTD_DATASET = '7e0b4365-fd63-4a29-8f5e-e0ac9f66a81b' // Medicare Part D Spending by Drug
const MEDICAID = 'https://data.medicaid.gov/api/1/datastore/query'
const CMS = 'https://data.cms.gov/data-api/v1/dataset'

// ── NADAC: latest acquisition price for a single 11-digit NDC ──
export interface NadacRow {
  url: string
  ndc11: string
  description: string
  per_unit_usd: number | null
  pricing_unit: string | null
  effective_date: string | null // yyyy-mm-dd (NADAC already serves ISO)
}

export async function fetchNadacForNdc(ndc11: string): Promise<NadacRow | null> {
  // percent-encode the DKAN bracket syntax so source_url is a strict-valid URI
  // (Zod url() is lenient; the MCP output-schema validator is not)
  const cond = `conditions%5B0%5D%5Bproperty%5D=ndc&conditions%5B0%5D%5Bvalue%5D=${ndc11}&conditions%5B0%5D%5Boperator%5D=%3D`
  const sort = `sorts%5B0%5D%5Bproperty%5D=effective_date&sorts%5B0%5D%5Border%5D=desc`
  const url = `${MEDICAID}/${NADAC_DATASET}/0?${cond}&${sort}&limit=1`
  const data = await getJsonOrNull<{ results?: Record<string, string>[] }>(url)
  const r = data?.results?.[0]
  if (!r) return null
  const n = Number(r.nadac_per_unit)
  return {
    url,
    ndc11,
    description: r.ndc_description ?? '',
    per_unit_usd: Number.isFinite(n) ? n : null,
    pricing_unit: r.pricing_unit ?? null,
    effective_date: r.effective_date?.slice(0, 10) ?? null,
  }
}

// ── Medicare Part D: national program spend context (NOT a patient price) ──
export interface PartDResult {
  url: string
  year: number | null
  total_spending_usd: number | null
  total_claims: number | null
  avg_spend_per_claim_usd: number | null
}

export async function fetchPartD(brand: string): Promise<PartDResult | null> {
  const url = `${CMS}/${PARTD_DATASET}/data?filter%5BBrnd_Name%5D=${encodeURIComponent(brand)}&size=1`
  const rows = await getJsonOrNull<Record<string, string>[]>(url)
  const r = Array.isArray(rows) ? rows[0] : undefined
  if (!r) return null
  // pick the latest year present in the columns (Tot_Spndng_<year>)
  const years = Object.keys(r)
    .map((k) => k.match(/^Tot_Spndng_(\d{4})$/)?.[1])
    .filter(Boolean)
    .map(Number)
  const year = years.length ? Math.max(...years) : null
  if (!year) return { url, year: null, total_spending_usd: null, total_claims: null, avg_spend_per_claim_usd: null }
  const num = (k: string): number | null => {
    const v = Number(r[k])
    return Number.isFinite(v) ? v : null
  }
  return {
    url,
    year,
    total_spending_usd: num(`Tot_Spndng_${year}`),
    total_claims: num(`Tot_Clms_${year}`),
    avg_spend_per_claim_usd: num(`Avg_Spnd_Per_Clm_${year}`),
  }
}
