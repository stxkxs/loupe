// DrugService — the single read layer over the prebuilt snapshot catalog (SPEC §4.4).
// The Hono API and the MCP server both call this, so an HTTP body and an MCP tool result
// are the SAME object. Node-only (uses fs); never imported by the browser SPA.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { Drug, DrugSummary, type Drug as DrugT, type DrugSummary as DrugSummaryT, type PanelKey } from './schema'

function snapshotDir(): string {
  try {
    return fileURLToPath(new URL('../data/snapshot', import.meta.url))
  } catch {
    // jsdom/test runtime: import.meta.url isn't a file URL — resolve from the repo root
    return resolve(process.cwd(), 'src/data/snapshot')
  }
}
const DIR = snapshotDir()

let cache: Map<string, DrugT> | null = null

function catalog(): Map<string, DrugT> {
  if (cache) return cache
  cache = new Map()
  if (!existsSync(DIR)) return cache
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.json') || f === 'index.json') continue
    // isolate per file: one malformed snapshot must not take down the whole catalog
    try {
      const drug = Drug.parse(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')))
      cache.set(drug.drug_id, drug)
    } catch (err) {
      console.error(`[loupe] skipping bad snapshot ${f}: ${(err as Error).message}`)
    }
  }
  return cache
}

/** Eagerly load + validate the catalog at startup so failures surface at boot, not mid-request. */
export function warmCatalog(): number {
  return catalog().size
}

export function getDrug(slug: string): DrugT | null {
  return catalog().get(slug) ?? null
}

function minNadac(d: DrugT): number {
  const prices = d.cost.points.map((p) => p.nadac_per_unit_usd).filter((n): n is number => n != null)
  return prices.length ? Math.min(...prices) : Infinity
}

export function toSummary(d: DrugT): DrugSummaryT {
  const primary =
    d.identity.classes.find((c) => c.class_type === 'EPC')?.class_name ??
    d.identity.classes.find((c) => c.class_type === 'ATC1-4')?.class_name ??
    null
  return DrugSummary.parse({
    drug_id: d.drug_id,
    brand_name: d.identity.brand_name,
    generic_name: d.identity.generic_name,
    rxcui: d.identity.rxcui,
    primary_class: primary,
    approval_status: d.identity.approval_status,
    shortage_status: d.shortage.status,
    est_package_cost_usd: d.cost.points.find((p) => p.est_package_cost_usd != null)?.est_package_cost_usd ?? null,
  })
}

export interface ListFilters {
  class?: string
  status?: string // approval_status
  shortage?: string // shortage_status
  sort?: 'cost' | 'name'
  limit?: number
}

export function listDrugs(f: ListFilters = {}): { count: number; results: DrugSummaryT[] } {
  let drugs = [...catalog().values()]
  if (f.class) drugs = drugs.filter((d) => d.identity.classes.some((c) => c.class_name.toLowerCase().includes(f.class!.toLowerCase())))
  if (f.status) drugs = drugs.filter((d) => d.identity.approval_status === f.status)
  if (f.shortage) drugs = drugs.filter((d) => d.shortage.status === f.shortage)
  drugs.sort((a, b) =>
    f.sort === 'cost' ? minNadac(a) - minNadac(b) : a.identity.brand_name.localeCompare(b.identity.brand_name),
  )
  if (f.limit && f.limit > 0) drugs = drugs.slice(0, f.limit)
  return { count: drugs.length, results: drugs.map(toSummary) }
}

export function searchDrugs(q: string, limit = 20): { query: string; results: DrugSummaryT[] } {
  const needle = q.toLowerCase()
  const results = [...catalog().values()]
    .filter(
      (d) =>
        d.identity.brand_name.toLowerCase().includes(needle) ||
        d.identity.generic_name.toLowerCase().includes(needle) ||
        d.identity.rxcui.includes(needle) ||
        d.drug_id.includes(needle),
    )
    .slice(0, limit)
    .map(toSummary)
  return { query: q, results }
}

export type PanelName = PanelKey
export function getPanel(slug: string, panel: PanelName) {
  const d = getDrug(slug)
  return d ? d[panel] : null
}

export function allSlugs(): string[] {
  return [...catalog().keys()]
}
