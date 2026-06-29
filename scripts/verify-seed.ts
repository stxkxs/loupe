// CI drift gate: re-resolve every seed `ingredient_rxcui` against RxNorm (name must match)
// and confirm openFDA has a label for each drug. Exit 1 on any drift so CI fails.
//   npm run verify-seed

import { DRUGS } from '../src/core/drugs.ts'
import { getJson, getJsonOrNull } from '../src/core/http.ts'

interface RxProps {
  properties?: { name?: string }
}
interface LabelResp {
  results?: unknown[]
}

let failures = 0

for (const d of DRUGS) {
  try {
    const props = await getJson<RxProps>(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${d.ingredient_rxcui}/properties.json`,
    )
    const name = props.properties?.name?.toLowerCase()
    if (name !== d.ingredient.toLowerCase()) {
      console.error(`✗ ${d.slug}: rxcui ${d.ingredient_rxcui} → "${name}", expected "${d.ingredient}"`)
      failures++
      continue
    }
  } catch (err) {
    console.error(`✗ ${d.slug}: RxNorm lookup failed — ${(err as Error).message}`)
    failures++
    continue
  }

  const term = d.brand
    ? `openfda.brand_name:%22${encodeURIComponent(d.brand)}%22`
    : `openfda.generic_name:%22${encodeURIComponent(d.ingredient)}%22`
  const label = await getJsonOrNull<LabelResp>(`https://api.fda.gov/drug/label.json?search=${term}&limit=1`)
  if (!label?.results?.length) {
    console.error(`✗ ${d.slug}: no openFDA label found`)
    failures++
    continue
  }
  console.log(`✓ ${d.slug}`)
}

if (failures) {
  console.error(`\n${failures} seed verification failure(s)`)
  process.exit(1)
}
console.log(`\nall ${DRUGS.length} seeds verified against RxNorm + openFDA`)
