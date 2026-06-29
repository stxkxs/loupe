# loupe — Runbook

loupe serves a static catalog built ahead of time. There is **no live upstream call at
request time**, so most "incidents" are about the catalog being stale or a refresh failing —
never about an upstream being down while users are on the site.

## Architecture recap

- `scripts/prefetch.ts` fans out to openFDA / RxNorm / RxClass / CMS / DailyMed, validates
  each record with `Drug.parse()`, and writes `src/data/snapshot/*.json` (committed).
- The API/SPA/MCP read those snapshots via `src/core/service.ts` (`warmCatalog()` validates
  them all at boot, so a bad snapshot fails the container at startup, not mid-request).

## Health & dashboards

- `GET /health` → `{ ok: true, drugs: <n> }`. The Docker `HEALTHCHECK` polls it.
- Each panel/datum carries `provenance { source, source_url, as_of, cache }`. `cache: cached`
  = served from the build-time snapshot. `meta.generated_at` is the snapshot timestamp.

## Failure modes & remediation

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Container exits at boot, log `skipping bad snapshot X` then 0 drugs | a snapshot is malformed | revert the bad `src/data/snapshot/X.json` (git) and redeploy; re-run `npm run prefetch -- X` |
| A drug's cost panel shows "No NADAC rows…" | that NDC set has no NADAC entry (real) or the NADAC dataset was re-keyed | run `npm run resolve-datasets`; if it fails, update the id in `src/core/sourcefetch/cms.ts` |
| `npm run prefetch` fails on one drug | upstream 404/5xx during fan-out (http.ts retries 5xx/429 + network) | re-run `npm run prefetch -- <slug>`; openFDA intermittently 500s — retry |
| openFDA prefetch throttled (HTTP 429) | keyless 1000/day shared-IP cap hit | set `OPENFDA_API_KEY` (free, 120k/day) and re-run |
| `npm run verify` red in CI | a seed rxcui drifted or a CMS dataset stopped resolving | fix the seed in `src/core/drugs.ts` / the dataset id in `cms.ts`; re-run |
| Data feels old | snapshots are from the last refresh | run `npm run prefetch` locally and redeploy |

## Refresh playbook

1. `OPENFDA_API_KEY=… npm run prefetch` (rebuilds all 12 snapshots).
2. `npm test` (the literals invariant + panel guardrails must stay green).
3. `npm run verify` (seeds + datasets still resolve).
4. Commit the changed `src/data/snapshot/*.json` and redeploy.

## Rollback

The catalog is just committed JSON — `git revert` the snapshot commit and redeploy. No
database, no migrations, no PHI.
