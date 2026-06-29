// The loupe query model + the "copy as API" engine (SPEC §4.3).
//
// A DrugQuery is the single source of truth a panel shows; the API URL, the
// shareable deep-link, and the copy-as-API snippets are all derived from it — so
// what an agent (or a human) sees on screen is exactly what they can lift as code.
// The read API is keyless, so snippets are plain HTTP (curl / requests / fetch).

import type { Provenance } from './provenance'

export type DrugResource =
  | 'drug'
  | 'drugs'
  | 'cost'
  | 'shortage'
  | 'alternatives'
  | 'label'
  | 'search'

export interface DrugQuery {
  resource: DrugResource
  id?: string
  params?: Record<string, string | number | undefined>
}

// same-origin in the browser; an absolute base is used for copyable snippets
export const API_HOST = (import.meta.env.VITE_LOUPE_API as string | undefined) ?? ''
export const APP_HOST =
  (import.meta.env.VITE_LOUPE_APP as string | undefined) ?? 'https://loupe.health'

const PATHS: Record<DrugResource, (id?: string) => string> = {
  drug: (id) => `/v1/drugs/${id}`,
  cost: (id) => `/v1/drugs/${id}/cost`,
  shortage: (id) => `/v1/drugs/${id}/shortage`,
  alternatives: (id) => `/v1/drugs/${id}/alternatives`,
  label: (id) => `/v1/drugs/${id}/label`,
  drugs: () => `/v1/drugs`,
  search: () => `/v1/search`,
}

// resource → the ?view= a deep-link should open to
const VIEW: Partial<Record<DrugResource, string>> = {
  drug: 'identity',
  cost: 'cost',
  shortage: 'supply',
  alternatives: 'alternatives',
  label: 'label',
}

function clean(params: DrugQuery['params']): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== '') out[k] = v
  }
  return out
}

export function queryUrl(q: DrugQuery): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(clean(q.params))) sp.set(k, String(v))
  const qs = sp.toString()
  return `${API_HOST}${PATHS[q.resource](q.id)}${qs ? `?${qs}` : ''}`
}

export function deepLink(q: DrugQuery): string {
  if (q.resource === 'search') {
    const term = clean(q.params).q
    return `${APP_HOST}/?q=${encodeURIComponent(String(term ?? ''))}`
  }
  const view = VIEW[q.resource] ?? 'identity'
  return `${APP_HOST}/?drug=${encodeURIComponent(q.id ?? '')}&view=${view}`
}

export interface ApiCall {
  url: string
  deepLink: string
  curl: string
  python: string
  ts: string
}

export function toApiCall(q: DrugQuery): ApiCall {
  const url = queryUrl(q)
  // snippets need an absolute URL even when the app talks same-origin
  const abs = url.startsWith('http') ? url : `${APP_HOST}${url}`
  const curl = `curl "${abs}"`
  const python = ['import requests', '', `r = requests.get("${abs}")`, 'r.raise_for_status()', 'data = r.json()'].join(
    '\n',
  )
  const ts = [`const res = await fetch("${abs}")`, 'const data = await res.json()'].join('\n')
  return { url, deepLink: deepLink(q), curl, python, ts }
}

/** The "cite this source" tab renders from a Provenance — NOT from toApiCall. */
export function citeSource(p: Provenance): { apa: string; bibtex: string } {
  const date = p.retrieved_at.slice(0, 10)
  const asof = p.as_of ? ` · AS OF ${p.as_of}` : ''
  const apa = `${p.source_label}. Retrieved ${date} from ${p.source_url}${asof}`
  const key = p.source.replace(/[^a-z0-9]/gi, '')
  const bibtex = [
    `@misc{${key},`,
    `  title = {${p.source_label}},`,
    `  howpublished = {\\url{${p.source_url}}},`,
    `  note = {Retrieved ${date}${asof}}`,
    `}`,
  ].join('\n')
  return { apa, bibtex }
}
