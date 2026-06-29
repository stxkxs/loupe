import { z } from 'zod'

/**
 * The ONE provenance shape (SPEC §4.1). snake_case on the wire.
 * Every sub-object carries `provenance: Provenance[]`; individual deep-linkable
 * data points carry a single `provenance`. Freshness is ONE enum: `cache`.
 */
export const SourceId = z.enum([
  'openfda_label',
  'openfda_shortages',
  'openfda_faers',
  'openfda_ndc',
  'rxnorm',
  'rxclass',
  'nadac',
  'medicare_partd',
  'dailymed',
])
export type SourceId = z.infer<typeof SourceId>

export const CacheState = z.enum(['live', 'cached', 'stale'])
export type CacheState = z.infer<typeof CacheState>

export const Provenance = z.object({
  source: SourceId,
  source_label: z.string(), // "openFDA Drug Label (SPL)"
  source_url: z.url(), // EXACT upstream query URL — the ↗ deep-link & cite target
  retrieved_at: z.iso.datetime(), // when prefetch/refresh pulled it
  as_of: z.iso.date().nullable(), // upstream's own publish/update date → the "AS OF" stamp
  cache: CacheState, // verified ≡ cache === 'live'
  record_id: z.string().nullable(), // setid / ndc11 / rxcui / nadac row id / faers query
})
export type Provenance = z.infer<typeof Provenance>
