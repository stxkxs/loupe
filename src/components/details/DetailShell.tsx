import type { ReactNode } from 'react'
import type { Provenance } from '@/core/provenance'
import { ProvenanceFootnote } from '@/components/ProvenanceFootnote'
import { cn } from '@/lib/utils'

/**
 * The common chrome for every spotlight detail: a full-height column whose body scrolls/grows
 * and whose footer is always the sourced ProvenanceFootnote. Keeps the "every panel cites its
 * sources" invariant structural — a detail can't render without its provenance footer.
 */
export function DetailShell({
  prov,
  body,
  children,
}: {
  prov: Provenance | Provenance[]
  /** body layout override (defaults to `space-y-4`); padding is always applied */
  body?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className={cn('flex-1 p-4', body ?? 'space-y-4')}>{children}</div>
      <ProvenanceFootnote prov={prov} />
    </div>
  )
}
