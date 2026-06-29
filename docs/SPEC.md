## loupe — SPEC.md

> One canonical page per GLP-1 / cardiometabolic drug, from five US-government datasets. Trust-first. Agent-native. Zero PHI.
> Tagline: **"Appraise the real value."**

> [!IMPORTANT]
> **Superseded UI/theme (this doc is the original v1 design spec).** The data layer, Zod
> `Drug` contract, Hono `/v1` API, MCP server, and guardrails are current. The **frontend
> has since evolved** and §5 (Frontend composition) and the theme notes in §color/§2 are
> historical: the app now ships a **light-default, light↔dark brand-styled theme** (warm
> `#fbfaf7` / periwinkle `#4d5cc9` / Fraunces + Schibsted Grotesk + Spline Sans Mono — not
> the dark teal/Inter theme described here) and an **overview-card → spotlight-morph**
> UX (`DrugHero` + `SummaryCard` + `components/details/*Detail.tsx` + `Spotlight`), not the
> `DrugPanel`/`CostPanel`/`SingleView` 5-panel grid described in §5. See `CLAUDE.md` for the
> live invariants and `src/` for the shipped components. This document captures the
> **original design**; where it and the shipped source under `src/` differ, `src/` is the
> source of truth — treat any stale specifics (component names, theme, deploy shape) as
> historical.

---

## 1. Product summary & the guardrail creed

**loupe** is a trust-first web app + read API + MCP server that unifies five free, keyless, public-domain US-government drug datasets into **one canonical page per GLP-1 / cardiometabolic drug**. Each page is five panels over one shared `Drug` contract: **(1) Identity & class, (2) Cost reality, (3) Live supply / shortage, (4) Label facts, (5) Same-class alternatives.** loupe is AI-native: agents are first-class users via deep-link-as-state, copy-as-API on every panel, data-behind-viz (JSON-LD + view-as-data), and an MCP server that returns **the identical contract the UI renders**.

### The guardrail creed (load-bearing — every item is a typed, rendered, and tested invariant)

A guardrail that isn't enforced by the **type system**, a **runtime guard**, and a **test** does not exist.

1. **Never dose-advise, never recommend a switch.** Same-class alternatives are informational and clinician-gated ("discuss with your care team" — never "take this instead").
2. **Cost ≠ copay.** NADAC is national-average *acquisition* cost. Every price carries a `cost_basis` and the persistent disclaimer.
3. **FAERS = reports, not rates.** Adverse-event counts are spontaneous reports; never an incidence rate, never a denominator, never used to rank drugs.
4. **Labels are quoted verbatim** with source citation + as-of date. No NLP, no paraphrase, ever.
5. **Production loading / empty / error / stale states** on all data; **stale** is honest, not hidden.
6. **Explicit disclosure:** "Not medical advice. Not affiliated with the FDA, NLM, or CMS." Surfaced in the UI, `llms.txt`, `navigator.json`, JSON-LD, and the MCP server/tool descriptions.

---

## 2. Architecture overview — one contract, three faces

```
                         ┌──────────────────────────────────────────┐
  BUILD / REFRESH (Node) │  scripts/prefetch.ts  (OPENFDA_API_KEY)   │
  ───────────────────────│  resolve-datasets → verify-seed →         │
  9 upstream APIs ──────▶ │  resolveDrug() fan-out → Drug.parse()     │
  (openFDA×4, RxNav,      │  → src/data/snapshot/<slug>.json (committed)
   RxClass, NADAC,        └────────────────────┬─────────────────────┘
   Part D, DailyMed)                           │  prebuilt static catalog
                                               ▼
                    ┌───────────────────────────────────────────────┐
                    │      THE ONE SCHEMA  —  src/core/schema.ts      │
                    │   Zod Drug + Identity/Cost/Shortage/Label/      │
                    │   Alternatives + Provenance + DrugSummary       │
                    └───────┬───────────────┬───────────────┬────────┘
                            │               │               │
                   ┌────────▼──────┐ ┌──────▼───────┐ ┌─────▼─────────┐
                   │ apps SPA      │ │ Hono read API │ │ MCP server     │
                   │ (renders Drug)│ │ /v1/* (reads  │ │ stdio (returns │
                   │ via /v1 proxy │ │  snapshot)    │ │  Drug slices)  │
                   └───────────────┘ └───────────────┘ └────────────────┘
                            └──── toApiCall(DrugQuery) ────┘
                          curl / python / ts snippets + deep-link
```

**Decisive architecture choices:**

- **Build-time-prefetched static catalog is the spine, decided at Goal 0/1 — not at deploy.** `scripts/prefetch.ts` runs in CI with the server `OPENFDA_API_KEY` (120k/day), fans out ~8 openFDA + RxNav/CMS/DailyMed calls per drug, validates with `Drug.parse()`, and writes committed `src/data/snapshot/<slug>.json`. This single decision simultaneously fixes (a) offline `vite build` + deterministic demo, (b) the 1000/day shared-IP keyless wall, and (c) the Lambda ephemeral-cache / per-instance-rate-limit problem.
- **No browser-direct upstream calls. No per-request Lambda fan-out.** The SPA talks only to the loupe API (or reads the static snapshot JSON); the Hono API is **read-only over the prebuilt catalog**. The browser never hits openFDA/RxNav/CMS/DailyMed, so CORS for those hosts is irrelevant and CSP `connect-src` is `self` + the loupe API origin only.
- **Freshness via scheduled refresh, not live fetch.** An EventBridge-scheduled refresh job (the same `prefetch` code) re-snapshots **the shortage slice** every ~6 h and the rest nightly, writing to the catalog store. The upstream rate-limit/timeout/429 queue lives only in this single-process job.
- **One package, shared `src/core`** via the `@ → ./src` alias (no pnpm monorepo). `api/` and `mcp/` import `core/` — exactly one assembly path.
- **OpenAPI via native Zod-4 `z.toJSONSchema()`** — no `@hono/zod-openapi`, no `zod-to-openapi`, avoiding the Zod-3/4 coupling hazard. Plain Hono + a hand-mounted `/openapi.json` generated from the contract.

---

## 3. Data layer & drug registry

### 3.1 File map

```
src/
  core/
    schema.ts            # THE ONE Zod contract (browser + node safe, zod 4)
    provenance.ts        # SourceId, Provenance (re-exported by schema.ts)
    query.ts             # DrugQuery + toApiCall + queryUrl + deepLink + PY_KEY
    errors.ts            # LoupeError (.toHttp() / .toMcp())
    sources.ts           # SOURCES manifest (id → label/base/rate-limit/no-key)
    drugs.ts             # curated SEED registry (provenance layer 1)
    ndc.ts               # to11() NDC normalization
    dataset-ids.ts       # resolved CMS NADAC + Part D dataset ids (generated)
    http.ts              # per-host rate-limit/timeout/429 queue (build/refresh only)
    resolveDrug.ts       # fan-out + assemble → Drug
    sourcefetch/
      rxnav.ts  rxclass.ts  openfda-label.ts  openfda-shortages.ts
      openfda-faers.ts  openfda-ndc.ts  nadac.ts  partd.ts  dailymed.ts
    __fixtures__/        # captured upstream JSON for golden tests
  data/
    snapshot/<slug>.json # committed, prefetched canonical Drug per slug
  lib/
    derive.ts            # ALL derivations; every export returns Derived<T>
    money/raw.ts         # usd() — import-restricted to Money.tsx ONLY
    money/axis.ts        # fmtUsdAxis() — the SANCTIONED chart/axis $ formatter
    costRamp.ts          # bespoke diverging $/unit ramp (literal hexes)
    charts/{cost,faers}.ts
scripts/
  resolve-datasets.ts    # discover CMS dataset ids → core/dataset-ids.ts
  verify-seed.ts         # re-resolve every RxCUI/NDC + assert query shapes; FAIL build on drift
  prefetch.ts            # run all fetchers + resolveDrug → data/snapshot/*.json
  refresh.ts             # scheduled re-snapshot (shortage 6h / full nightly)
  smoke.ts               # gated live hit of all 9 upstreams
```

### 3.2 Slug grammar & drug registry — `src/core/drugs.ts`

**Resolved: brand-level pages, slug `<ingredient>-<brand>`.** Cost and shortage differ sharply by brand (Ozempic vs Rybelsus vs Wegovy have different NDCs, NADAC, and shortage status), so a brand page is the honest unit of "cost reality." Generic-only anchors (`metformin`, `atorvastatin`) use bare-ingredient slugs.

The seed carries **only stable addressing keys** + the SPL-cited maintenance dose (for the est. $/mo derivation, §3.6). Every live fact is fetched, never hand-entered. A top-of-file provenance comment block names each source endpoint and "confirmed live YYYY-MM-DD."

```ts
export interface SeedDrug {
  slug: string                 // '<ingredient>-<brand>' or bare ingredient for generics
  ingredient: string           // RxNorm IN name, lowercase
  ingredient_rxcui: string     // verified by verify-seed.ts
  brand: string                // 'Ozempic'; '' for generic
  marketed_for: string         // descriptive label, NOT an approval claim
  representative_ndcs: string[] // 11-digit (5-4-2) NADAC + /drug/ndc join keys
  atc: { code: string; name: string }
  epc: string
  /** SPL-cited maintenance dose, the ONLY input to the est. $/mo Derived value (§3.6). */
  maintenance: { dose: string; per_days: number; spl_cited: true } | null
}
export const DRUGS: SeedDrug[]
export const DRUG_BY_SLUG: Record<string, SeedDrug>
```

**v1 roster (12 brand-level pages — reconciled, one roster):**

| slug | ingredient | RxCUI* | brand (marketed_for) | ATC | EPC |
|---|---|---|---|---|---|
| `semaglutide-ozempic` | semaglutide | 1991302 | Ozempic (T2D) | A10BJ06 | GLP-1 RA |
| `semaglutide-wegovy` | semaglutide | 1991302 | Wegovy (weight) | A10BJ06 | GLP-1 RA |
| `semaglutide-rybelsus` | semaglutide | 1991302 | Rybelsus (T2D oral) | A10BJ06 | GLP-1 RA |
| `tirzepatide-mounjaro` | tirzepatide | 2601723 | Mounjaro (T2D) | A10BX16 | GIP+GLP-1 RA |
| `tirzepatide-zepbound` | tirzepatide | 2601723 | Zepbound (weight) | A10BX16 | GIP+GLP-1 RA |
| `dulaglutide-trulicity` | dulaglutide | 1551291 | Trulicity (T2D) | A10BJ05 | GLP-1 RA |
| `liraglutide-victoza` | liraglutide | 475968 | Victoza (T2D) | A10BJ02 | GLP-1 RA |
| `liraglutide-saxenda` | liraglutide | 475968 | Saxenda (weight) | A10BJ02 | GLP-1 RA |
| `empagliflozin-jardiance` | empagliflozin | 1545653 | Jardiance (T2D/CV) | A10BK03 | SGLT2 Inhibitor |
| `dapagliflozin-farxiga` | dapagliflozin | 1488564 | Farxiga (T2D/CKD) | A10BK01 | SGLT2 Inhibitor |
| `metformin` | metformin | 6809 | (generic, T2D) | A10BA02 | Biguanide |
| `atorvastatin` | atorvastatin | 83367 | (generic, lipid) | C10AA05 | HMG-CoA Reductase Inhibitor |

\* Seed values re-verified by `verify-seed.ts`, which **fails the build** on any RxCUI/NDC drift. `metformin` + `atorvastatin` are deliberate cheap-generic anchors — a NADAC of cents-per-unit beside a branded GLP-1 makes the "cost ≠ copay" point land. The slug list **is** the registry: it drives prefetch, the `?drug=` enum, `llms.txt`, `navigator.json`, and the MCP `list_drugs` tool.

### 3.3 CMS dataset discovery — `scripts/resolve-datasets.ts`

NADAC is **one stable DKAN dataset** with all weekly rows (column `effective_date`), not rotating per-week UUIDs.

- **NADAC:** `GET https://data.medicaid.gov/api/1/metastore/schemas/dataset/items?show-reference-ids` → select the item whose `title` matches `/^NADAC \(National Average Drug Acquisition Cost\)$/` with the most recent `modified` → resolve its datastore distribution id. Query rows via `…/api/1/datastore/query/{datasetId}/0?conditions[0][property]=ndc&conditions[0][value]=<ndc11>&conditions[0][operator]==&sort[0][property]=effective_date&sort[0][order]=desc&limit=1`.
- **Medicare Part D Spending by Drug:** discover via the data.cms.gov metastore by title match → `GET https://data.cms.gov/data-api/v1/dataset/{id}/data?filter[Brnd_Name]=<brand>&size=1`.

Resolved ids are written to `src/core/dataset-ids.ts`; CI re-runs the resolver and **fails on drift**. This is scheduled as an explicit Goal-1.5 deliverable (§7), not hand-waved.

### 3.4 NDC normalization — `src/core/ndc.ts`

The NADAC↔NDC join is a classic silent-failure point. **Canonical key = 11-digit HIPAA NDC (5-4-2, no hyphens).** openFDA `/drug/ndc` returns `product_ndc` (10-digit, 2 segments) and `packaging[].package_ndc` in 5-4-2 / 5-3-2 / 5-4-1 segmentations.

```ts
// to11('0002-1506-80') → '00021506 80' → '00021506080' ... etc.
export function to11(ndc: string): string  // split 3 segments, left-pad to 5/4/2, concat
export function segmentsOf(ndc: string): [string, string, string]
```

`verify-seed.ts` validates every seed `representative_ndcs` entry against both the openFDA NDC directory and a NADAC lookup; a join that returns zero rows **fails the build**, surfacing coverage gaps before they become a broken demo.

### 3.5 Source fetchers — `src/core/sourcefetch/*.ts`

Each fetcher takes a `SeedDrug` (or a resolved RxCUI/NDC), builds the exact URL, calls `http.getJson`, and returns a slice stamped with its `Provenance` (`source_url` = the literal request URL).

| File | Example call | Reads → |
|---|---|---|
| `rxnav.ts` | `…/REST/rxcui.json?name=Ozempic` ; `…/REST/rxcui/1991302/properties.json` | ingredient/RxCUI/UNII confirm; brand RxCUIs. Also the `verify-seed` drift check. |
| `rxclass.ts` | `…/rxclass/class/byRxcui.json?rxcui=1991302` ; `…/rxclass/classMembers.json?classId=A10BJ&relaSource=ATC` | ATC/EPC/MoA classes; same-class members → alternatives (intersected with registry). |
| `openfda-label.ts` | `…/drug/label.json?search=openfda.rxcui:"1991302"&limit=1` (fallback `openfda.brand_name`) | `boxed_warning`, `dosage_and_administration` (whole section, verbatim), `adverse_reactions`, `indications_and_usage`, `effective_time`, `openfda.spl_set_id`, `openfda.pharm_class_*`. |
| `openfda-shortages.ts` | `…/drug/shortages.json?search=generic_name:"semaglutide"&limit=20` | `status`, `reason_for_shortage`, `availability_information`, `presentation`, `update_date`, `initial_posting_date`. |
| `openfda-faers.ts` | `…/drug/event.json?search=patient.drug.openfda.generic_name:"semaglutide"&count=patient.reaction.reactionmeddrapt.exact` | top reported MedDRA PT counts → `faers_top_reactions` (top 15). Second `&limit=1` call reads `meta.results.total`. Counts only — never a rate. |
| `openfda-ndc.ts` | `…/drug/ndc.json?search=generic_name:"semaglutide"&limit=50` | `product_ndc`, `packaging[].description`/`package_ndc`, `active_ingredients[].strength`, `dosage_form`, `route`, `brand_name`, `dea_schedule`. |
| `nadac.ts` | NADAC datastore query (§3.3) by `to11(ndc)` | `nadac_per_unit`, `pricing_unit`, `ndc_description`, `effective_date`. |
| `partd.ts` | Part D dataset query (§3.3) by brand | latest-year `Tot_Spndng`, `Avg_Spnd_Per_Clm`, `Tot_Clms`, `year` → a single **context** line, never a patient price. |
| `dailymed.ts` | `…/services/v2/spls.json?rxcui=1991302` | `setid`, `published_date` (authoritative label `as_of`), human deep-link `…/drugInfo.cfm?setid={setid}`. |

**Field-shape verification (must-fix):** `verify-seed.ts` and the first `prefetch` assert that the shortages and FAERS queries return rows for known-good drugs (FAERS records do carry the `openfda` harmonization block; shortages search by `generic_name`/`proprietary_name`). A zero-row result for a seed drug **fails loudly** rather than silently emitting an empty panel.

**Out of scope:** drug-interaction checking — the NLM Drug Interaction API was discontinued in Jan 2024; loupe makes no interaction claims and calls it nowhere.

### 3.6 `Derived` values & the est. $/month (must-fix)

NADAC is priced per `ML`/`EA`/`GM` by NDC. **Factual, never-derived figures: `nadac_per_unit_usd` and `est_package_cost_usd` (= per-unit × units-in-package, both from the NADAC row + NDC packaging).** A monthly figure requires a maintenance dose — dose-adjacent reasoning — so it is treated as an **explicit, label-cited estimate, not data**:

- `src/lib/derive.ts` exports **every** derivation as `Derived<T> = { value: T; estimated: true; method: string }`.
- `estMonthlyCost(seed, costPoint): Derived<number> | null` returns `null` unless `seed.maintenance` (an SPL-cited dose) exists; `method` = `"1 package / ${per_days} days at the maintenance dose stated on the SPL (${dose})"`.
- It renders **only** through `<Money price={{ costBasis: 'estimated' }}>` / `<Estimate>`, always marked `est.` with the method tooltip and an SPL citation.
- A `derive.test.ts` asserts every `derive.ts` export returns `{ estimated: true, method: <non-empty> }`.

The headline on the Cost panel is **`est_package_cost_usd` (factual)**; the est. $/mo appears secondarily, clearly framed. The worked example (§4.5) is updated to call $/mo an estimate.

### 3.7 `src/core/http.ts` — upstream queue (build/refresh only)

A per-host rate-limit queue — `Map<host, { lastAt: number; recent: number[]; chain: Promise<void> }>` — because the build hits five hostnames with different budgets. 15 s `AbortSignal.timeout`, retry-twice-on-429 (sleep ~1400 ms), retry-once-on-timeout. Per-host budgets keep openFDA under **240 req/min**; the server `OPENFDA_API_KEY` lifts the daily ceiling from 1000 to 120k/day. This module runs **only** in `prefetch`/`refresh` (a single Node process), so its in-memory counters are correct — never on a per-request Lambda.

```ts
export interface FetchResult<T> { data: T; url: string; fetchedAt: string }
export async function getJson<T>(url: string): Promise<FetchResult<T>> // throws with status + first 180 chars of body
```

`OPENFDA_API_KEY` is a **server/CI env var**, appended as `&api_key=…` inside `http.ts`. It is **never** `VITE_OPENFDA_API_KEY` — VITE_ vars bundle into client JS and would leak the key (and there is no client-side upstream path anyway).

---

## 4. The Drug Zod contract + read API + MCP tools

**This is the single source of truth.** It is parsed by `prefetch`, serialized verbatim by the Hono API, returned byte-for-byte by the MCP tools, used to type the React panels, and drives the copy-as-API snippets and `/openapi.json`. Nothing is hand-shaped twice.

### 4.1 The ONE provenance shape, casing, and SourceId (resolves the four-schema contradiction)

- **Casing:** snake_case on the wire (matches money-api).
- **Wrapping strategy:** each **sub-object** (`Identity`, `Cost`, `Shortage`, `Label`, `Alternatives`) carries `provenance: Provenance[]` (one per contributing source); individual deep-linkable data points (`CostPoint`, `LabelQuote`, `FaersReaction`'s parent) carry their own single `provenance`. No per-field `Sourced<T>` generic.
- **Freshness:** ONE model — the `cache: 'live' | 'cached' | 'stale'` enum (the `verified`/`cached` booleans are gone; `verified` ≡ `cache === 'live'`).
- **SourceId enum (one list):** `openfda_label`, `openfda_shortages`, `openfda_faers`, `openfda_ndc`, `rxnorm`, `rxclass`, `nadac`, `medicare_partd`, `dailymed`.

```ts
// src/core/provenance.ts
import { z } from 'zod';
export const SourceId = z.enum([
  'openfda_label','openfda_shortages','openfda_faers','openfda_ndc',
  'rxnorm','rxclass','nadac','medicare_partd','dailymed',
]);
export type SourceId = z.infer<typeof SourceId>;

export const Provenance = z.object({
  source: SourceId,
  source_label: z.string(),          // "openFDA Drug Label (SPL)"
  source_url: z.url(),               // EXACT upstream query URL — the ↗ deep-link & cite target
  retrieved_at: z.iso.datetime(),    // when prefetch/refresh pulled it
  as_of: z.iso.date().nullable(),    // upstream's own publish/update date → the "AS OF" stamp
  cache: z.enum(['live','cached','stale']),
  record_id: z.string().nullable(),  // setid / ndc11 / rxcui / nadac row id / faers query
});
export type Provenance = z.infer<typeof Provenance>;
```

### 4.2 `src/core/schema.ts` — the canonical record

Guardrail strings are **`z.literal(...).default(...)`** fields. Because the prefetch store **omits** them and `Drug.parse()` back-fills them, every serialized object always carries the guardrail and it appears as a `const` in `/openapi.json` and MCP `outputSchema`.

> **Correction (must-fix):** `z.literal().default()` only fills `undefined`; it does **not** coerce a present-but-different value — a stale/edited literal makes `parse()` **throw**, not heal. Therefore **snapshot JSON omits all guardrail literals**; a test (`trust/literals.test.ts`) asserts the snapshot files contain none of the literal strings, and that `Drug.parse()` fills them.

```ts
import { z } from 'zod';
import { Provenance, SourceId } from './provenance.js';

// ── Approval reduced to what sources actually provide (must-fix) ──
//   approved  = an SPL exists in openFDA.  black-box = structured boxed_warning present.
//   off-label / withdrawn / investigational are RESERVED, never emitted in v1 (no source).
export const ApprovalStatus = z.enum(['approved','black-box','off-label','withdrawn','investigational']);
export const ShortageStatus = z.enum(['available','limited','in-shortage','discontinued','resolved']);

// ── Panel 1: Identity / class ──
export const DrugClass = z.object({
  class_id: z.string(), class_name: z.string(),
  class_type: z.enum(['ATC1-4','MOA','EPC','PE','CHEM']),
  rela_source: z.string().nullable(),
});
export const Identity = z.object({
  brand_name: z.string(), generic_name: z.string(), rxcui: z.string(),
  manufacturer: z.string().nullable(),
  approval_status: ApprovalStatus,         // only 'approved' emitted in v1
  has_boxed_warning: z.boolean(),          // structured boxed_warning present
  classes: z.array(DrugClass),
  routes: z.array(z.string()), strengths: z.array(z.string()),
  provenance: z.array(Provenance),         // rxnorm + rxclass + ndc + label
});

// ── Panel 2: Cost reality ──
export const CostPoint = z.object({
  ndc11: z.string(), description: z.string(),
  nadac_per_unit_usd: z.number().nullable(),
  pricing_unit: z.string().nullable(),     // ML | EA | GM
  units_per_package: z.number().nullable(),
  est_package_cost_usd: z.number().nullable(),  // FACTUAL: per_unit × units_per_package
  est_monthly_cost_usd: z.number().nullable(),  // DERIVED/est. — null unless SPL maintenance dose exists
  est_monthly_method: z.string().nullable(),    // the Derived<T>.method string, when est_monthly present
  effective_date: z.iso.date().nullable(),
  provenance: Provenance,                  // nadac
});
export const MedicareSpend = z.object({
  total_spending_usd: z.number().nullable(),
  total_claims: z.number().nullable(),
  avg_spend_per_claim_usd: z.number().nullable(),
  year: z.number().nullable(),
  provenance: Provenance,                  // medicare_partd
}); // rendered as a single context line, never a patient price
export const Cost = z.object({
  cost_basis: z.literal('NADAC acquisition, not patient copay')
    .default('NADAC acquisition, not patient copay'),
  disclaimer: z.literal('Cost ≠ copay. NADAC is the national average price pharmacies pay to ACQUIRE the drug — not list price and not what a patient pays. Out-of-pocket depends on insurance, manufacturer savings cards, and pharmacy.')
    .default('Cost ≠ copay. NADAC is the national average price pharmacies pay to ACQUIRE the drug — not list price and not what a patient pays. Out-of-pocket depends on insurance, manufacturer savings cards, and pharmacy.'),
  points: z.array(CostPoint),
  package_low_usd: z.number().nullable(), package_high_usd: z.number().nullable(),
  medicare_context: MedicareSpend.nullable(),
  coverage_note: z.string().nullable(),    // e.g. "No NADAC rows for this NDC set" — empty-state, NOT a fake price
  provenance: z.array(Provenance),
});

// ── Panel 3: Live supply ──
export const Shortage = z.object({
  status: ShortageStatus,
  reason: z.string().nullable(),           // VERBATIM reason_for_shortage
  resupply_estimate: z.string().nullable(),// VERBATIM availability_information
  presentations_affected: z.array(z.string()),
  initial_posting_date: z.iso.date().nullable(), update_date: z.iso.date().nullable(),
  disclaimer: z.literal('Reflects the FDA Drug Shortages database as of update_date. National status — your pharmacy may differ.')
    .default('Reflects the FDA Drug Shortages database as of update_date. National status — your pharmacy may differ.'),
  provenance: Provenance,                  // openfda_shortages
});

// ── Panel 4: Label facts (verbatim) ──
export const LabelQuote = z.object({
  section: z.enum(['boxed_warning','dosage_and_administration','adverse_reactions','indications_and_usage','warnings']),
  text: z.string(),                        // VERBATIM whole-section SPL text
  highlight: z.string().nullable(),        // a sentence to EMPHASIZE in place (e.g. missed-dose) — never extracted alone
  truncated: z.boolean(),
});
export const FaersReaction = z.object({ reaction: z.string(), report_count: z.number() }); // MedDRA PT + count
export const Label = z.object({
  setid: z.string(), spl_version: z.string().nullable(), effective_time: z.iso.date().nullable(),
  dailymed_url: z.url(),
  quotes: z.array(LabelQuote),
  faers_total_reports: z.number().nullable(),
  faers_top_reactions: z.array(FaersReaction),
  faers_query: z.string(),                 // the exact search= the counts cover
  faers_disclaimer: z.literal('FAERS counts are spontaneous adverse-event REPORTS, not incidence rates. A report does not establish causation; counts reflect reporting behavior and market size.')
    .default('FAERS counts are spontaneous adverse-event REPORTS, not incidence rates. A report does not establish causation; counts reflect reporting behavior and market size.'),
  label_disclaimer: z.literal('Label text is quoted verbatim from the FDA Structured Product Label (SPL). Not a substitute for the full prescribing information reviewed with your clinician.')
    .default('Label text is quoted verbatim from the FDA Structured Product Label (SPL). Not a substitute for the full prescribing information reviewed with your clinician.'),
  provenance: z.array(Provenance),         // openfda_label + dailymed + openfda_faers
});

// ── Panel 5: Same-class alternatives (clinician-gated) ──
export const Alternative = z.object({
  drug_id: z.string().nullable(),          // slug if in registry, else null
  brand_name: z.string(), generic_name: z.string(), rxcui: z.string(),
  shared_class: z.string(), shared_class_type: z.string(),
  in_registry: z.boolean(),
  provenance: Provenance,                  // rxclass
});
export const Alternatives = z.object({
  basis: z.literal('Grouped by shared pharmacologic class (RxClass ATC/MoA/EPC). Informational only.')
    .default('Grouped by shared pharmacologic class (RxClass ATC/MoA/EPC). Informational only.'),
  clinician_gate: z.literal('Informational only — not a recommendation. Discuss with your care team. Do not start, stop, or switch any medication on your own. loupe never advises a switch.')
    .default('Informational only — not a recommendation. Discuss with your care team. Do not start, stop, or switch any medication on your own. loupe never advises a switch.'),
  same_class: z.array(Alternative),
  provenance: z.array(Provenance),
});

// ── The canonical record ──
export const DrugMeta = z.object({
  generated_at: z.iso.datetime(),
  freshness: z.enum(['live','cached','stale']),
  disclaimer: z.literal('Not medical advice. loupe is not affiliated with the FDA, NLM, or CMS. Drug-PRODUCT reference data only — zero PHI.')
    .default('Not medical advice. loupe is not affiliated with the FDA, NLM, or CMS. Drug-PRODUCT reference data only — zero PHI.'),
  sources: z.array(Provenance),            // flattened union
});
export const Drug = z.object({
  drug_id: z.string(), schema_version: z.literal('1').default('1'),
  identity: Identity, cost: Cost, shortage: Shortage, label: Label, alternatives: Alternatives,
  meta: DrugMeta,
});
export type Drug = z.infer<typeof Drug>;

export const DrugSummary = z.object({
  drug_id: z.string(), brand_name: z.string(), generic_name: z.string(), rxcui: z.string(),
  primary_class: z.string().nullable(),
  approval_status: ApprovalStatus, shortage_status: ShortageStatus.nullable(),
  est_package_cost_usd: z.number().nullable(),   // FACTUAL package cost (not derived $/mo)
});
export type DrugSummary = z.infer<typeof DrugSummary>;
```

### 4.3 `src/core/query.ts` — `DrugQuery` + `toApiCall` (one query type, one return shape)

A single query type — `DrugQuery`, the only one (`LoupeQuery` is an alias for it). **Resolved return shape: `{ url, deepLink, curl, python, ts }`.** The "cite this source" tab does **not** use `toApiCall`; it renders from a `Provenance` via a separate `citeSource(prov)` helper.

```ts
export type DrugResource = 'drug' | 'drugs' | 'cost' | 'shortage' | 'alternatives' | 'label' | 'search';
export interface DrugQuery { resource: DrugResource; id?: string; params: Record<string, string|number|undefined>; }

export const API_HOST = import.meta.env?.VITE_LOUPE_API ?? '';            // same-origin in browser; absolute for snippets
export const APP_HOST = import.meta.env?.VITE_LOUPE_APP ?? 'https://loupe.health';
const PY_KEY: Record<string,string> = { q: 'query', id: 'drug_id' };

const PATHS: Record<DrugResource,(id?:string)=>string> = {
  drug:(id)=>`/v1/drugs/${id}`, cost:(id)=>`/v1/drugs/${id}/cost`,
  shortage:(id)=>`/v1/drugs/${id}/shortage`, alternatives:(id)=>`/v1/drugs/${id}/alternatives`,
  label:(id)=>`/v1/drugs/${id}/label`, drugs:()=>`/v1/drugs`, search:()=>`/v1/search`,
};
const VIEW: Partial<Record<DrugResource,string>> = { drug:'identity', cost:'cost', shortage:'supply', alternatives:'alternatives', label:'label' };

export function queryUrl(q: DrugQuery): string { /* API_HOST + PATHS[q.resource](q.id) + ?clean(params) */ }
export function deepLink(q: DrugQuery): string { /* APP_HOST/?drug=<id>&view=<VIEW[resource]> | ?q=<q> */ }

export interface ApiCall { url: string; deepLink: string; curl: string; python: string; ts: string }
export function toApiCall(q: DrugQuery): ApiCall {
  // curl = `curl "<url>"`  (keyless — no header)
  // python uses pyMethod map (must match MCP tool names §4.4); ts uses openapi-fetch<paths>
}

// Separate — the cite tab:
export function citeSource(p: Provenance): { apa: string; bibtex: string } {
  // apa: `${p.source_label}. Retrieved ${p.retrieved_at.slice(0,10)} from ${p.source_url}` + " · AS OF " + p.as_of
}
```

The `pyMethod` map and the MCP tool names (§4.4) are the **same identifiers** — generated python always calls a tool the server exposes.

### 4.4 Hono read API + MCP — one `DrugService`, one path scheme, one tool-name set

`apps`-free single package: `api/app.ts` and `mcp/server.ts` both depend on **one** `DrugService` (`src/core/service.ts`) that reads the prebuilt snapshot store. The HTTP body and the MCP tool result are therefore identical objects.

**HTTP routes (resolved `/v1` scheme — Vite proxies `/v1/*` → `:8787`):**

| Method + path | Body (zod) | Notes |
|---|---|---|
| `GET /v1/drugs` | `{ count, results: DrugSummary[], _meta }` | filters `?class=&status=&shortage=&sort=cost\|name&limit=` |
| `GET /v1/drugs/:slug` | `Drug` | full canonical record |
| `GET /v1/drugs/:slug/:panel` | `Identity\|Cost\|Shortage\|Label\|Alternatives` | `panel ∈ identity\|cost\|shortage\|label\|alternatives` |
| `GET /v1/search?q=` | `{ query, results: DrugSummary[], _meta }` | **curated-registry substring** over brand/generic/rxcui; `q` required → 400 if missing. No RxNorm `approximateTerm` in v1. |
| `GET /openapi.json` | OpenAPI 3.1 | generated from zod via `z.toJSONSchema({ target:'openapi-3.0' })` |
| `GET /docs` | HTML | `@scalar/hono-api-reference`, dark theme |
| `GET /health`, `GET /` | — | service index: `{ service, version, drugs, sources, docs, mcp:'stdio' }` |

```ts
app.get('/v1/drugs/:slug', async (c) => {
  const drug = await service.getDrug(c.req.param('slug'));
  if (!drug) return c.json(new LoupeError('not_found','unknown drug_id').toHttp().body, 404);
  return c.json(Drug.parse(drug)); // parse() back-fills the omitted guardrail literals
});
```

**MCP server (`mcp/server.ts`, `@modelcontextprotocol/sdk`, stdio only in v1):** standard `Server` + `setRequestHandler` shape; each tool advertises an `outputSchema` via `z.toJSONSchema(...)` and returns both `content[].text` (stringified) and `structuredContent`. **One tool-name set (resolved):**

| Tool | Input | Returns |
|---|---|---|
| `get_drug` | `{ drug_id }` | `Drug` |
| `list_drugs` | `{ class?, status?, shortage?, sort?, limit? }` | `{ count, results: DrugSummary[] }` |
| `search_drugs` | `{ query, limit? }` | `{ query, results: DrugSummary[] }` |
| `get_drug_cost` | `{ drug_id }` | `Cost` (incl. `cost_basis` + `disclaimer`) |
| `get_drug_shortage` | `{ drug_id }` | `Shortage` |
| `get_drug_label` | `{ drug_id }` | `Label` (verbatim quotes + FAERS counts) |
| `get_drug_alternatives` | `{ drug_id }` | `Alternatives` (incl. `clinician_gate`) |

Every tool description prepends the global disclosure + the relevant guardrail framing.

### 4.5 Worked example — "Can I afford Zepbound right now?" (via MCP)

Agent connected to the stdio MCP server; "right now" needs cost reality + live supply.

```
tools/call search_drugs { "query": "Zepbound" }
→ { "query":"Zepbound", "results":[ { "drug_id":"tirzepatide-zepbound","brand_name":"Zepbound",
     "generic_name":"tirzepatide","rxcui":"2601723","primary_class":"GIP/GLP-1 receptor agonist",
     "approval_status":"approved","shortage_status":"available","est_package_cost_usd":1082.48 } ] }

tools/call get_drug_cost { "drug_id":"tirzepatide-zepbound" }
→ { "cost_basis":"NADAC acquisition, not patient copay",
    "disclaimer":"Cost ≠ copay. NADAC is the national average price pharmacies pay to ACQUIRE …",
    "package_low_usd":1012.40, "package_high_usd":1086.50,
    "points":[ { "ndc11":"00021506080","description":"ZEPBOUND 2.5 MG/0.5ML AUTO-INJECTOR",
       "nadac_per_unit_usd":270.62,"pricing_unit":"EA","units_per_package":4,
       "est_package_cost_usd":1082.48,
       "est_monthly_cost_usd":1082.48,"est_monthly_method":"1 package / 28 days at the maintenance dose stated on the SPL (one auto-injector weekly)",
       "effective_date":"2026-06-18",
       "provenance":{ "source":"nadac","source_label":"CMS NADAC (acquisition cost)",
         "source_url":"https://data.medicaid.gov/api/1/datastore/query/…?conditions[0][value]=00021506080…",
         "as_of":"2026-06-18","cache":"cached","record_id":"00021506080" } } ],
    "medicare_context":{ "total_spending_usd":5900000000,"year":2024,"provenance":{ "source":"medicare_partd",… } },
    "coverage_note":null, "provenance":[ … ] }

tools/call get_drug_shortage { "drug_id":"tirzepatide-zepbound" }
→ { "status":"available","reason":null,"update_date":"2026-06-27",
    "disclaimer":"Reflects the FDA Drug Shortages database as of update_date. National status — your pharmacy may differ.",
    "provenance":{ "source":"openfda_shortages","source_url":"https://api.fda.gov/drug/shortages.json?search=…tirzepatide…","as_of":"2026-06-27","cache":"cached" } }
```

`get_drug_cost` returns the `Cost` slice — `cost_basis` ("NADAC acquisition, not patient copay"), the cost `disclaimer`, the per-NDC `points[]` (NADAC `$/unit`, the factual `est_package_cost_usd`, and an SPL-cited `est_monthly_cost_usd` estimate carrying its `method`), `package_low_usd`/`package_high_usd`, and the Part D `medicare_context`. `get_drug_shortage` returns the `Shortage` slice — `status` (`available`), `update_date`, and the national-status `disclaimer`. An agent composes the two: the shortage `status` + `update_date` answer availability, the cost `points[]` + `cost_basis` answer price, and every guardrail string arrives structurally in the payload rather than from the agent's own phrasing.

Because `cost_basis`, the cost `disclaimer`, the shortage `disclaimer`, and `meta.disclaimer` are literal-defaulted, they appear in **every** payload — impossible to omit. The JSON is byte-identical to what Panels 2 and 3 render at `https://loupe.health/?drug=tirzepatide-zepbound&view=cost`.

---

## 5. Frontend composition

A dashboard SPA: React 19.2 + Vite 8 + TS 6 strict, Tailwind 4.3 CSS-first (one `@theme{}` block, no `tailwind.config.js`), TanStack Query 5 + Router 1, ECharts 6 (canvas, imperative wrapper), motion v12 + `MotionConfig reducedMotion="user"`, lucide, `cn()`, `@fontsource` Inter + JetBrains Mono. Tokens (bg `#0a0a0b`, surface `#111113`/`#161618`, fg `#ededef`>muted `#7e7e85`>dim `#52525a`, border `rgba(255,255,255,.07)`, primary teal `#3e8e82`, success/warning/danger, `--ease-out-expo`). `<main>` is `overflow-y-auto` because one drug stacks five panels. **MapLibre is not included** (no map source in v1).

### 5.1 Route + deep-link state — `src/router.tsx`, `src/routes/DrugPage.tsx`

One TanStack Router route at `/`, `validateSearch(loupeSearchSchema)`, `defaultPreload:'intent'`.

```ts
export interface LoupeSearch {
  drug: string;                       // slug; default DEFAULT_DRUG = 'semaglutide-ozempic'
  view: 'all'|'identity'|'cost'|'supply'|'label'|'alternatives';   // default 'all'
  source?: string;                    // a source_id → opens cite-this-source tab (no drawer in v1)
}
```

`DrugPage` follows a standard dashboard pattern: `useSearch()`, `useNavigate({ from:'/' })`, and `set = (patch)=>navigate({ search: prev=>({ ...prev, ...patch }) })` so the view **is** the URL. `view !== 'all'` anchor-scrolls via `id={view}`. The unified record is fetched once per slug through `useDrug(slug)` (`src/hooks/useDrug.ts`, wraps `useQuery`, calls `GET /v1/drugs/:slug` through the Vite proxy → returns the one `Drug`). **There is no `useSource`/panel-local upstream fetch** — every panel reads from the single `useDrug` query; freshness is whatever the prebuilt snapshot carries (`meta.freshness` + per-datum `cache`).

`DEFAULT_DRUG = 'semaglutide-ozempic'`.

### 5.2 App shell — `src/components/AppShell.tsx`

Header inside `flex h-screen flex-col bg-bg`. Wordmark `font-mono text-[14px] font-semibold text-primary` "loupe" + subtitle `text-[12px] text-dim` "appraise the real value · openFDA · CMS · RxNorm". Right cluster: a **global `CopyAsApi`** whose `DrugQuery` resolves to the canonical `GET /v1/drugs/:slug` + the MCP `get_drug` snippet ("lift the whole page as one contract"), distinct from per-panel CopyAsApi which emits the specific loupe panel call. A persistent footer line `text-[10px] text-dim` carries the disclosure: **"Not medical advice · not affiliated with the FDA."** No keyless badge / no `VITE_OPENFDA_API_KEY` UI — the browser never calls upstreams.

### 5.3 SegmentedNav

`SegmentedNav<T>` — a motion `layoutId` sliding pill (`whileTap scale 0.96`, `spring stiffness 500 damping 38`, `aria-pressed`). Two groups in v1:

1. **Drug picker** — `<DrugNav>` over the curated `DRUGS` roster (mono pills), `onChange={(d)=>set({ drug:d })}`. No combobox / no RxNorm full-set in v1.
2. **View focus** — `items={['all','identity','cost','supply','label','alternatives']}`, neutral `activePill="bg-hover" activeText="text-fg"`.

### 5.4 Layout — `src/views/SingleView.tsx`

```tsx
<main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-3 overflow-y-auto p-3">
  <StatStrip drug={drug} />
  <div className="grid auto-rows-min grid-cols-1 gap-3 lg:grid-cols-6">
    <IdentityPanel     drug={drug} className="lg:col-span-6" id="identity" />
    <CostPanel         drug={drug} className="lg:col-span-4" id="cost" />
    <SupplyPanel       drug={drug} className="lg:col-span-2" id="supply" />
    <LabelPanel        drug={drug} className="lg:col-span-3" id="label" />
    <AlternativesPanel drug={drug} className="lg:col-span-3" id="alternatives" />
  </div>
</main>
```

### 5.5 `DrugPanel` — `src/components/DrugPanel.tsx`

`DrugPanel` provides `className` (grid span), `footnote`, and a `stale` ribbon. Bordered header with right-aligned actions: `<CopyAsApi query={query} />` + the `view-as-data ⇄ viz` toggle; baked-in inline JSON-LD `Dataset` (`distribution.contentUrl = queryUrl(query)`). New `<footer>` slot renders `footnote`. `query: DrugQuery` (the one type).

### 5.6 The five panels — `src/components/panels/*` (chart inputs aligned to the contract)

**(1) `IdentityPanel.tsx`** — full-width banner. Wordmark `font-mono text-[18px] font-semibold` (brand) + generic + RxCUI in `font-mono text-[11px] text-dim`. Neutral class chip (descriptive, no semantic color). Two StatusChips: **approval** (`approved→success` "FDA approved") and, when `identity.has_boxed_warning`, a separate **boxed-warning→danger** chip. NDC strengths as mono chips. `footnote` = RxNorm + openFDA NDC, deep-linked to `provenance.source_url`.

**(2) `CostPanel.tsx`** — pinned **"This is NOT your copay"** warning banner. Headline = **`est_package_cost_usd`** (factual) in `font-mono text-[22px] tabular-nums`, heat-tinted by `costColor()` from the bespoke ramp. Secondary line: the est. $/mo via `<Money price={{costBasis:'estimated'}}>` (marked `est.` + method tooltip) **only when present**. Part D context line `font-mono text-[11px] text-muted`. `DataTable` of `cost.points[]` (NADAC `$/unit` by NDC/strength, each cell heat-tinted). **ECharts: a horizontal `bar` of `$/unit` per NDC** from `buildCostBars(cost.points)` (`src/lib/charts/cost.ts`) — **no time-trend** (`cost.trend` does not exist). Axis/tooltip use `fmtUsdAxis` from `src/lib/money/axis.ts` (the sanctioned chart $ formatter — `usd()` stays restricted to `Money.tsx`). If `cost.points` is empty / all `nadac_per_unit_usd` null, render the `coverage_note` empty state (`Center`) — never a fabricated price. `footnote` = CMS NADAC + CMS Part D.

```ts
// src/lib/costRamp.ts — bespoke diverging $/unit ramp, literal hexes (NOT a token)
export const COST_RAMP = ['#3b82f6','#22d3ee','#3e8e82','#a3e635','#facc15','#fb923c','#ef4444'] as const;
export function costColor(v: number, domain:[number,number]=[0,300]): string { /* piecewise-lerp */ }
```

**(3) `SupplyPanel.tsx`** — large shortage `StatusChip` (`available→success` "No current shortage", `limited→warning`, `in-shortage→danger`, `discontinued→dim line-through`). Below: verbatim **reason** + **resupply** + **as-of** (`font-mono text-[11px]`). **No status-history timeline** — the sources give current + posting + update dates, not a series. `footnote` = openFDA Drug Shortages.

**(4) `LabelPanel.tsx`** — **verbatim whole-section quote cards** via `VerbatimQuote` (`LabelQuote`). The missed-dose handling: render the **entire** `dosage_and_administration` section verbatim and **highlight** the `LabelQuote.highlight` sentence in place — never surface a regex fragment as "the rule." Boxed warnings: `danger`-styled collapsible `<details>`, verbatim, cited. Common side effects, two clearly separated sub-blocks: **(a)** the SPL `adverse_reactions` list (cited) and **(b)** FAERS bars from `buildFaersBars(label.faers_top_reactions)` (contract field name) under a permanent **"REPORTS, NOT RATES"** banner; bars are neutral `text-muted` fill (never ramped — counts ≠ risk), y-axis literally `reports (count)`, never `%`. `footnote` = openFDA SPL + DailyMed + a separate openFDA FAERS footnote.

**(5) `AlternativesPanel.tsx`** — RxClass members as **clinician-gated cards** (`AlternativeCard.tsx`): name, class-match basis (ATC/MoA/EPC mono tag), no "switch to" verbs, muted surface, no CTA styling. Persistent gate banner: `ShieldAlert` + **"Informational only. Same therapeutic class ≠ interchangeable. Discuss any change with your care team."** Cards with `in_registry` deep-link to their own page via `set({ drug: alt.drug_id })` — framed "view appraisal," never "take instead." `footnote` = NLM RxClass.

### 5.7 Shared components

- **`StatusChip.tsx`** — `inline-flex … rounded-md px-2 py-0.5 text-[11px]` + static `SEM_CLASS` record + dot + lucide icon + text label (non-color encoding). Domain → semantic via one typed record: `approval` and `shortage` only. **`EVIDENCE` is not included** (no source provides evidence levels).
- **`ProvenanceFootnote.tsx`** — `font-mono text-[10px] uppercase tracking-wide text-dim`: `SOURCE: {source_label} · AS OF {as_of}` + `ExternalLink` `↗` to `provenance.source_url` + native `title` + a freshness dot from the single `cache` enum (`live→success`, `cached→warning`, `stale→danger`).
- **`Center.tsx`** — the single loading/error/empty/stale funnel; error variant `text-danger` + raw upstream message; stale variant `'ribbon'` shows `cached · AS OF …` without masking data.
- **`CopyAsApi.tsx`** — portalled motion modal, `curl | python | ts` tabs + a fourth **"cite"** tab rendered from `citeSource(prov)` (APA + BibTeX), copy-with-checkmark, `Escape` close, `aria-modal`.
- **`charts/EChart.tsx`** — imperative wrapper; every chart is `lazy()` + `<Suspense fallback={<Center>loading chart…</Center>}>`. Option builders are pure transforms in `src/lib/charts/{cost,faers}.ts` (Vitest-unit-tested), wrapped in `ChartFigure` (§6).
- **`DataTable.tsx`** — backs every `view-as-data` toggle so an agent reads exact numbers without operating a chart.

---

## 6. Trust, guardrails & accessibility

### 6.1 Trust types (`src/lib/derive.ts`, `src/lib/money/*`, `src/components/trust/*`)

```ts
export interface Derived<T> { value: T; estimated: true; method: string } // every derive.ts export
```

`Price`/cost rendering: prices render **only** through `<Money>`, which appends a `CostBasisBadge` and stamps `data-cost-basis` (the cost-basis test asserts on it). `usd()` in `src/lib/money/raw.ts` is **import-restricted to `Money.tsx`** via eslint `no-restricted-imports`; `fmtUsdAxis()` in `src/lib/money/axis.ts` is the **separate, allowed** formatter for ECharts axes/tooltips (resolves the "charts have no sanctioned money formatter" gap).

### 6.2 The five guardrails (typed + rendered + tested)

1. **Cost ≠ copay** — `GuardrailBanner variant="cost"` pinned non-dismissible atop the Cost panel; `cost_basis` literal on every `Cost`; `CostBasisBadge` (`ACQ`/`PROGRAM`/`EST`) on every price; cost color is redundant (numeric mono value always present, WCAG 1.4.1).
2. **FAERS = reports, not rates** — `GuardrailBanner variant="faers"` above the bars; `FaersDisclaimer` is the chart's `<figcaption>`; bars constrained so the visual cannot imply incidence (y-axis `reports (count)`, decal hatching, no `%`, no denominator computed anywhere).
3. **Verbatim-only labels** — content typed `LabelQuote` (never bare `string`); rendered only through `VerbatimQuote` reproducing `text` byte-for-byte with `setid` + `effective_time`. **No NLP/summarization step exists in the label pipeline.** Missed-dose is highlighted in the whole-section quote, never extracted alone.
4. **Clinician-gated alternatives** — `ClinicianGate` ("Discuss with your care team") on the panel; `src/lib/copy.ts ALTERNATIVES_COPY` exposes only non-imperative strings; a test asserts the alternatives module never matches `/\btake this instead\b|\bswitch to\b|\bbetter than\b|\bshould use\b/i`.
5. **Global disclosure** — one `DISCLOSURE` constant rendered in four asserted surfaces: `DisclosureFooter`, `public/llms.txt`, `public/.well-known/navigator.json`, `index.html` JSON-LD, and the MCP server/tool descriptions.

**Approval claim (must-fix):** no algorithmic `off-label`/`withdrawn`/`investigational`. `approval_status` emits only `approved` (an SPL exists); boxed warning comes from the structured `boxed_warning` field as a separate danger chip. No `marketed_for`-vs-`indications` comparison.

### 6.3 Provenance at four layers

| Layer | Where | What |
|---|---|---|
| 1 Source comment | `src/core/drugs.ts` top-of-file | brand→ingredient→RxCUI→NDC + "confirmed live YYYY-MM-DD" per source |
| 2 JSON-LD | `index.html` | `WebApplication` + `about:Dataset` (creator Orgs FDA/NLM/CMS, `disclaimer: DISCLOSURE`); inline `Dataset` per `DrugPanel` |
| 3 Per-datum ↗ | `ProvenanceFootnote` | `SOURCE: … · AS OF …` + exact `source_url` link + tooltip + single `cache`-enum freshness dot |
| 4 Agent manifests | `public/llms.txt` + `public/.well-known/navigator.json` | **generated from `DRUGS` + `SourceId` + the `Drug` field list**, so they cannot drift; enumerate drugs, 9 sources, fields, deep-link grammar (`?drug=&view=&source=`), rate limits, MCP tool names, and a `limitations` array |

### 6.4 Accessibility — WCAG 2.2 AA

Focus-visible 2px primary ring; skip link; full keyboard path (real `<button>`/`<a>`, `aria-pressed`, focus-trapped/`Escape`-closable `CopyAsApi`); `ChartFigure` wraps every viz with an `sr-only` summary + an always-present `DataTable` text alternative; ECharts `aria:{enabled:true,decal:{show:true}}` + `role="img"`; non-color status (dot + icon + label); reduced motion via both `MotionConfig reducedMotion="user"` and the CSS kill-switch + `option.animation=false`; reflow to 320px / 200% zoom; 24×24 min targets. No forms/auth → 3.3.7/3.3.8 N/A (noted).

### 6.5 Privacy posture

All public, **zero PHI** — drug-product reference data only; no login, no PII. `validateSearch` whitelists `?drug=&view=&source=` to enums/known slugs, so URLs can carry only a public drug id + view name — deep links are safe to share. **CSP `connect-src 'self' + the loupe API origin only`** (the browser never calls upstreams — resolves the CSP-vs-server-proxy contradiction in favor of server-proxied). No third-party analytics. Request logs structurally cannot contain free text (enum-only inputs).

### 6.6 Guardrail test plan (Vitest + ESLint)

`trust/cost-basis.test.tsx` (every `[data-price]` has `[data-cost-basis]`; `<Money>` throws in DEV without `costBasis`), `trust/derive.test.ts` (every `derive.ts` export returns `{estimated:true, method:<non-empty>}`), `trust/literals.test.ts` (snapshot JSON omits guardrail literals; `Drug.parse()` fills them), `trust/verbatim.test.ts` (snapshot-equals input), `trust/alternatives.test.ts` (deny-list regex), `trust/disclosure.test.ts` (DISCLOSURE in all five surfaces), `trust/faers.test.tsx` (figcaption "reports"/"not rates"; axis `reports (count)`, no `%`), `provenance/footnote.test.tsx`. **Lint:** `no-restricted-imports` bans `@/lib/money/raw` outside `Money.tsx`. **CI gate:** `tsc --noEmit && vitest run && eslint .`.

---

## 7. Build sequence

The spine is the **prebuilt-snapshot catalog over the one `src/core/schema.ts` contract**. Each goal merges green (`tsc --noEmit && vite build && vitest run`) and ships something runnable.

### Goal 0 — Scaffold + design system + **architecture & schema locked** · ~1 day
**Ships:** app skeleton; `src/index.css` `@theme{}` block; `cn()`, `Center`, `DrugPanel`, `StatusChip`, `ProvenanceFootnote` stubs; single `/` route with `loupeSearchSchema`; `MotionConfig reducedMotion="user"`; `index.html` `class="dark"` + JSON-LD `WebApplication` stub. **Locked as Goal-0 deliverables (the cross-cutting decisions):** the one provenance shape + casing + `SourceId` enum; brand-level slug grammar; the 12-drug roster; `/v1` path scheme; the MCP tool-name set; **prebuilt-static-catalog architecture**; **server `OPENFDA_API_KEY`, never `VITE_`**; OpenAPI via native Zod-4 `z.toJSONSchema`. A static fixture `Drug` (`semaglutide-ozempic`) renders five labeled empty panels.
**Demo:** `npm run dev` → dark loupe page, five panels, view/drug nav, chips from the typed record.
**Acceptance:** build green; `vitest run` green (`cn` + status-record golden); deep-link params round-trip `validateSearch`.

### Goal 1 — `core/schema.ts` + http queue + first live fetcher → **snapshot-backed render** · ~1.5 days
**Ships:** the full Zod `Drug` contract; `core/http.ts` (per-host queue refactor); identity spine `core/sourcefetch/rxnav.ts` + `rxclass.ts`; `core/drugs.ts` curated registry. `scripts/resolve.ts` prints a resolved identity slice. **Goal 1's SPA renders a committed snapshot JSON** (honest "real data, cached") — NOT a live API (the API doesn't exist until Goal 2; the architecture is server-proxied, so there is no endpoint to query yet).
**Demo:** `npx tsx scripts/resolve.ts semaglutide-ozempic` prints real RxCUI + ATC; the Identity panel shows live ingredient/brand/class from the snapshot with `ProvenanceFootnote`.
**Acceptance:** `rxnav.test.ts` maps a fixture → identity slice; `Drug.parse()` succeeds; `npm run smoke` hits RxNav live (200 + RxCUI).

### Goal 1.5 — dataset resolution + seed verification + **prefetch/snapshot pass** · ~0.5–1 day
**Ships:** `scripts/resolve-datasets.ts` (CMS NADAC + Part D ids → `core/dataset-ids.ts`), `scripts/verify-seed.ts` (RxCUI/NDC drift + NDC-join + shortages/FAERS field-shape assertions; **fails build on drift**), `core/ndc.ts` (`to11`), `scripts/prefetch.ts` writing `src/data/snapshot/*.json`. These gate the NADAC/Part D fetchers and the offline build — scheduled here, not discovered at deploy.
**Demo:** `npm run prefetch` regenerates all 12 snapshots offline; `cat src/data/snapshot/semaglutide-ozempic.json | jq .meta`.
**Acceptance:** `resolve-datasets` finds both dataset ids; `verify-seed` passes for all 12; `Drug.parse()` succeeds on every snapshot.

### Goal 2 — Hono read API + OpenAPI (contract over the wire) · ~1–1.5 days
**Ships:** `api/app.ts` reading the snapshot store via one `DrugService`; routes `/v1/drugs`, `/v1/drugs/:slug`, `/v1/drugs/:slug/:panel`, `/v1/search`, `/openapi.json` (native Zod-4 `z.toJSONSchema`), `/docs` (Scalar). Vite dev proxies `/v1/*` → `:8787`; the SPA's panels now fetch `GET /v1/drugs/:slug` — render-from-contract is true at the network layer.
**Demo:** `curl localhost:8787/v1/drugs/semaglutide-ozempic | jq .cost`; open `/docs`.
**Acceptance:** `openapi.json` validates; `/v1/drugs/:slug` Zod-parses in a test; unknown slug → 404; smoke hits the running API.

### Goal 3 — Panels 2–5 on live (snapshotted) data · ~3–4 days (the bulk)
One fetcher + one panel per sub-step, each merged green:
- **3a Cost** — `nadac.ts` + `partd.ts`; `CostPanel` $/unit bars + heat table + cost≠copay banner + factual `est_package_cost_usd` headline + est. $/mo (Derived). NADAC coverage gaps → `coverage_note` empty state, never a fake price.
- **3b Supply** — `openfda-shortages.ts`; `SupplyPanel` status chip + verbatim reason/resupply + as-of.
- **3c Label** — `openfda-label.ts` + `dailymed.ts`; verbatim whole-section quotes + DailyMed deep-link; FAERS via `openfda-faers.ts` "top reported reactions" with the reports-not-rates banner.
- **3d Alternatives** — RxClass grouping → clinician-gated cards deep-linking within the registry.
- `openfda-ndc.ts` feeds strengths/presentations into Identity + Cost.
**Demo:** full `semaglutide-ozempic` page live across all five panels; `view as data` on each; a NADAC ↗ opens data.medicaid.gov.
**Acceptance:** golden normalizer test per source against a captured fixture; ≥3 drugs resolve with all five sections non-empty; verbatim label string equals upstream byte-for-byte; FAERS values are integer counts.

### Goal 4 — MCP server (same contract for agents) · ~1–1.5 days
**Ships:** `mcp/server.ts` (`@modelcontextprotocol/sdk`, **stdio only**) with the seven tools (`get_drug`, `list_drugs`, `search_drugs`, `get_drug_cost`, `get_drug_shortage`, `get_drug_label`, `get_drug_alternatives`) wrapping the same `DrugService`; `outputSchema` from the same Zod types; each description carrying disclosure + guardrail framing. `mcp.json` for Claude Desktop / Claude Code.
**Demo:** register the server; "shortage status of tirzepatide-mounjaro?" → `get_drug_shortage` returns status + reason + AS-OF.
**Acceptance:** MCP inspector lists 7 tools with JSON schemas; `get_drug` output Zod-parses; **contract-parity test** asserts `get_drug_cost(slug)` deep-equals API `/v1/drugs/:slug/cost`.

### Goal 5 — Provenance artifacts (the 4-layer story) · ~0.5–1 day
**Ships:** layers 1–4 completed: `// SOURCE:` comments; `index.html` + per-panel JSON-LD `Dataset`; per-datum ↗ + cite tab; `public/llms.txt` + `public/.well-known/navigator.json` generated from `core`.
**Demo:** `curl /llms.txt`; `curl /.well-known/navigator.json | jq .drugs`; open the cite tab → exact openFDA URL.
**Acceptance:** `navigator.json` validates against a Zod schema generated from `core`; every enumerated drug resolves; every cite URL reachable (smoke).

### Goal 6 — a11y + guardrail polish · ~1 day
**Ships:** focus ring, aria/sr-only, non-color status, reduced motion, production loading/empty/error/**stale** `Center` on every panel; always-visible cost≠copay, FAERS-reports-not-rates, alternatives clinician-gate, verbatim-with-citation, global disclosure. No dose/switch language anywhere.
**Demo:** keyboard-only walkthrough; force a stale snapshot → AS-OF + stale chip.
**Acceptance:** `vitest-axe` 0 serious violations; every panel renders all four states in tests; guardrail strings asserted in the DOM.

### Goal 7 — Deploy (static-catalog spine) · ~1 day
**Ships:** `infra/` AWS-CDK: S3 + CloudFront (OAC) for the SPA **and the snapshot catalog JSON**; the Hono app on a single Lambda Function URL serving `/v1/*` + `/openapi.json` + `/docs` **read-only over the catalog in S3** (no upstream fan-out from Lambda → no per-instance budget/cache problem). An EventBridge-scheduled `refresh` Lambda (single invocation) re-snapshots shortage ~6 h / full nightly using the server `OPENFDA_API_KEY`, writing to S3. MCP stays stdio-local for the demo.
**Demo:** `https://loupe.<domain>/?drug=semaglutide-ozempic`; `curl https://api.loupe.<domain>/v1/drugs/semaglutide-ozempic`.
**Acceptance:** deployed SPA loads; API returns a schema-valid `Drug` from S3; smoke passes against prod; Lighthouse a11y ≥ 95.

### Effort summary
| Goal | Lands | Effort |
|---|---|---|
| 0 | Scaffold + design system + locked schema/architecture | ~1d |
| 1 | Contract + http queue + RxNav identity (snapshot render) | ~1.5d |
| 1.5 | dataset resolution + verify-seed + prefetch/snapshot | 0.5–1d |
| 2 | Hono API + OpenAPI, render-from-contract | 1–1.5d |
| 3 | Cost / Supply / Label+FAERS / Alternatives live | 3–4d |
| 4 | MCP server (7 tools, same contract) | 1–1.5d |
| 5 | 4-layer provenance | 0.5–1d |
| 6 | a11y + guardrail polish | 1d |
| 7 | CDK deploy (static catalog + scheduled refresh) | 1d |
| | **Total** | **~10.5–14 days** |

---

## 8. Test & deploy plan

**Vitest, multi-project (resolves the env contradiction):** `vitest.config.ts` declares two projects — `node` (`src/core/**`, `api/**`, `mcp/**`) and `jsdom`/happy-dom (`src/components/**`, `src/routes/**`, a11y) — so node-side normalizer/parity tests and DOM panel/`vitest-axe` tests coexist.

- **Golden tests** — each `core/sourcefetch/*.ts` normalizer vs a captured `__fixtures__/*.json`; the $/unit ramp bucketing; status-record mapping; `to11` NDC normalization; `toApiCall` snippet generation; `navigator.json` shape; **verbatim-equality** of label text (the legal guardrail); FAERS integer counts.
- **Contract-parity test** — API slice `===` MCP tool output `===` the object the SPA renders, all from `core`, by deep-equal. Proof of "one contract, three faces."
- **Snapshot integrity** — every `src/data/snapshot/*.json` `Drug.parse()`s and omits the guardrail literals.
- **Smoke** (`RUN_SMOKE=1`, gated) — hits each of the 9 live upstreams once for a known drug (200 + key field + latency), then `/v1/drugs/semaglutide-ozempic` and MCP `get_drug`. Runs nightly in CI (respects budgets) and via `npm run smoke`.
- **CI** — `tsc --noEmit && vite build && vitest run && eslint .` per PR; smoke nightly.

**Deploy** — AWS-CDK (S3 + CloudFront + a read-only Hono Lambda Function URL over the S3 catalog + a scheduled `refresh` Lambda). `cdk deploy` is the whole deploy. License Apache-2.0.

---

## 9. README

**README shape:**
1. One-liner + "Appraise the real value" + who it's FOR (cardiometabolic/GLP-1 telehealth; agents first-class).
2. Three principles (deep-links, copy-as-API, data-behind-viz) + four provenance layers.
3. The five panels mapped to the nine US-government sources: endpoint, refresh cadence, "no key".
4. **Assumptions** — curated brand-level registry, not a formulary; NADAC = acquisition, not copay; $/mo is an SPL-cited *estimate*; FAERS = reports, not rates; zero PHI.
5. **Scope & limitations** — no drug-interaction checking (the NLM Interaction API was discontinued Jan 2024; loupe makes no interaction claims); no dosing advice or switch recommendations; no patient-specific copay (no PBM/eligibility data); no auth/PHI; no derived regulatory status (off-label/withdrawn would manufacture a claim).
6. Guardrails section + the explicit "not medical advice / not affiliated" disclosure.
7. Architecture diagram (prefetch → snapshot → SPA/API/MCP over one `core/schema.ts`) + run/test/smoke/deploy commands.