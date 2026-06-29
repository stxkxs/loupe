import { useQuery } from '@tanstack/react-query'
import { Drug } from '@/core/schema'

// Data source: the committed, prefetched snapshots, loaded via import.meta.glob. The
// panels are agnostic to the source — a `/v1` API fetch returns the SAME `Drug` contract.
// Drug.parse() back-fills the guardrail literals the snapshot omits.
const loaders = import.meta.glob('../data/snapshot/*.json')

export function useDrug(slug: string) {
  return useQuery({
    queryKey: ['drug', slug],
    queryFn: async (): Promise<Drug> => {
      const load = loaders[`../data/snapshot/${slug}.json`]
      if (!load) throw new Error(`No snapshot for "${slug}". Run: npm run prefetch`)
      const mod = (await load()) as { default: unknown }
      return Drug.parse(mod.default)
    },
  })
}
