# loupe

**Appraise the real value.** One canonical, sourced page per GLP-1 / cardiometabolic
drug — real acquisition cost, live FDA shortage status, verbatim label facts, and
same-class alternatives — unified from five free, keyless, public-domain US-government
datasets. Built **agent-native**: deep-links, copy-as-API on every panel, and an MCP
server return the *same* `Drug` contract the human UI renders.

> Not medical advice. loupe is not affiliated with the FDA, NLM, or CMS.
> Drug-PRODUCT reference data only — zero PHI.

## What it does

loupe unifies five public-domain US-government drug datasets into one sourced page per
GLP-1 / cardiometabolic drug: the NADAC acquisition cost, current FDA shortage status,
verbatim label facts, and same-class alternatives — each value carrying its source and
as-of date.

## Guardrails

A guardrail that isn't enforced by the **type system**, a **runtime guard**, and a
**test** does not exist.

1. Never dose-advise, never recommend a switch — alternatives are clinician-gated.
2. **Cost ≠ copay** — NADAC is acquisition cost; every price carries `cost_basis`.
3. **FAERS = reports, not rates** — never an incidence rate, never a denominator.
4. Labels are **quoted verbatim** with source + as-of date. No paraphrase, ever.
5. Honest loading / empty / error / **stale** states on all data.
6. Explicit "not medical advice / not affiliated" disclosure across UI, API, and MCP.

## Architecture — one contract, three faces

A build-time prefetch (`scripts/prefetch.ts`) fans out to all upstreams, validates each
record with `Drug.parse()`, and commits a static catalog (`src/data/snapshot/*.json`).
The **SPA**, the **Hono read API**, and the **MCP server** all read that one `Drug`
contract (`src/core/schema.ts`) — nobody live-hits the upstreams at request time, so the
demo is deterministic and no rate-limit budget bites. Snapshots **omit** the guardrail
literals; `Drug.parse()` back-fills them on read, so a snapshot can never ship a tampered
disclaimer (enforced by `src/core/literals.test.ts`).

```
upstreams ──prefetch──▶ src/data/snapshot/*.json ──▶ Drug (src/core/schema.ts)
  openFDA ×4                                            │      │       │
  RxNorm/RxClass                                      SPA   Hono /v1  MCP (stdio)
  CMS NADAC + Part D                            (bundled)  (agents)  (agents)
  DailyMed                                  toApiCall(DrugQuery) → curl/python/ts + deep-link
```

## Run it

```bash
npm install
npm run prefetch     # rebuild the catalog from live upstreams (committed; optional)
npm run dev          # SPA  → http://localhost:3001
npm run api          # API  → http://localhost:8787  (also serves the built SPA)
npm run mcp:smoke    # spawns the MCP server and runs the "can I afford Zepbound?" example
npm test             # vitest: contract, snapshot-literal invariant, guardrail-render, UI
npm run test:coverage # the above + a coverage gate on the request-time logic (CI-enforced)
npm run build        # tsc --noEmit && vite build
```

### Agent surfaces

- **Read API** (keyless): `GET /v1/drugs`, `/v1/drugs/{slug}`, `/v1/drugs/{slug}/{panel}`,
  `/v1/search?q=` · OpenAPI at `/openapi.json` · docs at `/docs`.
- **Discovery**: `/llms.txt` and `/.well-known/navigator.json`.
- **MCP** (stdio) — add to an MCP client:
  ```json
  { "mcpServers": { "loupe": { "command": "npx", "args": ["tsx", "src/mcp/server.ts"] } } }
  ```
  Tools: `get_drug`, `list_drugs`, `search_drugs`, `get_drug_cost`, `get_drug_shortage`,
  `get_drug_label`, `get_drug_alternatives`.

## Deploy

One container serves both faces (the SPA bundles its own catalog; the API serves `/v1`):

```bash
docker build -t loupe . && docker run -p 8787:8787 loupe
# → http://localhost:8787  (SPA at /, API at /v1, docs at /docs)
```

Snapshots are committed, so the image builds with no network. To refresh, run
`npm run prefetch` and redeploy.

## Example

`/?drug=tirzepatide-zepbound&view=cost` opens the cost view for Zepbound. The same data is
available without the UI — `GET /v1/drugs/tirzepatide-zepbound/cost`, the `get_drug_cost`
MCP tool, or a panel's "copy as API" snippet — each returns the same `Drug` projection.

## Key decisions

- **Build-time static catalog**, not live per-request fetch — fixes deterministic demo +
  the openFDA 1000/day shared-IP wall + Lambda cold-cache in one move.
- **est. $/mo only when it needs no clinical assumption** (oral, dose-countable). For
  mL-priced injectables it's withheld; the factual package cost is shown instead.
- **Approval = "an SPL exists" + `has_boxed_warning`** — we never algorithmically infer
  `off-label`/`withdrawn` (that would manufacture a regulatory claim).
- **NDC normalized to 11-digit 5-4-2** before the NADAC join (classic silent-fail point).

See [`docs/SPEC.md`](docs/SPEC.md) for the full data contract and rationale.

## License

[Apache License 2.0](LICENSE). The underlying datasets are public-domain US-government
works (FDA, NLM, CMS); loupe is not affiliated with those agencies.
