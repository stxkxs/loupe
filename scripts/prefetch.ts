// Build-time prefetch (SPEC §2). Fans out to every upstream for each seed drug, composes
// a validated Drug (literal-free), and writes committed snapshots. The SPA, the Hono API,
// and the MCP server all read these — nobody live-hits the upstreams at request time.
//
//   npm run prefetch                      # all drugs
//   npm run prefetch -- semaglutide-wegovy tirzepatide-zepbound   # a subset
//
// Reads OPENFDA_API_KEY from the environment if present (lifts the keyless cap).

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DRUGS } from '../src/core/drugs.ts'
import { resolveDrug } from '../src/core/resolveDrug.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../src/data/snapshot')
const nowIso = new Date().toISOString()

const only = process.argv.slice(2)
const targets = only.length ? DRUGS.filter((d) => only.includes(d.slug)) : DRUGS

await mkdir(OUT, { recursive: true })

const index: { slug: string; brand: string; generic: string }[] = []
let ok = 0
for (const seed of targets) {
  process.stdout.write(`• ${seed.slug.padEnd(26)} `)
  try {
    const drug = await resolveDrug(seed, nowIso)
    await writeFile(resolve(OUT, `${seed.slug}.json`), JSON.stringify(drug, null, 2) + '\n')
    index.push({ slug: seed.slug, brand: seed.brand, generic: seed.ingredient })
    ok++
    console.log(
      `ok — ${drug.cost.points.length} nadac · shortage:${drug.shortage.status} · ` +
        `${drug.label.faers_top_reactions.length} faers · ${drug.alternatives.same_class.length} alts`,
    )
  } catch (err) {
    console.log(`FAIL — ${(err as Error).message}`)
  }
}

await writeFile(resolve(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`\nwrote ${ok}/${targets.length} snapshots → src/data/snapshot/`)
if (ok < targets.length) process.exitCode = 1
