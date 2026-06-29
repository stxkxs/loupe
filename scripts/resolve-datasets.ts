// CI drift gate: confirm the pinned CMS dataset ids (see src/core/sourcefetch/cms.ts)
// still return rows. Exit 1 if a dataset stops resolving so CI fails before a refresh
// silently produces empty cost/Part-D data.
//   npm run resolve-datasets

import { getJsonOrNull } from '../src/core/http.ts'

// keep these ids in sync with src/core/sourcefetch/cms.ts
const CHECKS = [
  {
    name: 'CMS NADAC',
    url: 'https://data.medicaid.gov/api/1/datastore/query/fbb83258-11c7-47f5-8b18-5f8e79f7e704/0?limit=1',
  },
  {
    name: 'CMS Medicare Part D Spending',
    url: 'https://data.cms.gov/data-api/v1/dataset/7e0b4365-fd63-4a29-8f5e-e0ac9f66a81b/data?size=1',
  },
]

let failures = 0

for (const check of CHECKS) {
  const data = await getJsonOrNull<unknown>(check.url)
  const rows = Array.isArray(data)
    ? data.length
    : ((data as { results?: unknown[] } | null)?.results?.length ?? 0)
  if (!rows) {
    console.error(`✗ ${check.name}: dataset returned no rows — ${check.url}`)
    failures++
  } else {
    console.log(`✓ ${check.name}: dataset live`)
  }
}

if (failures) {
  console.error(`\n${failures} dataset check(s) failed`)
  process.exit(1)
}
console.log('\nall pinned CMS datasets resolve')
