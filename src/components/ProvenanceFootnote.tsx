import { ArrowUpRight, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Provenance } from '@/core/provenance'

// Provenance made visible but quiet (SPEC §signature_moves): a single "sources · N · as of …"
// line that opens a popover with the exact upstream docs (↗) + live/cached chips on hover/focus.
export function ProvenanceFootnote({ prov }: { prov: Provenance | Provenance[] }) {
  const list = Array.isArray(prov) ? prov : [prov]
  const seen = new Set<string>()
  const sources = list.filter((p) => {
    const key = `${p.source}:${p.source_url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!sources.length) return null
  const latest = sources
    .map((p) => p.as_of)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

  return (
    <div className="group/prov relative border-t border-border px-4 py-2">
      <button
        type="button"
        className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-dim uppercase hover:text-fg"
      >
        sources · {sources.length}
        {latest ? ` · as of ${latest}` : ''}
        <ChevronUp className="h-3 w-3" aria-hidden="true" />
      </button>
      <div className="pointer-events-none absolute bottom-[calc(100%-2px)] left-3 z-10 w-[330px] max-w-[calc(100vw-2rem)] translate-y-1 rounded-md border border-border bg-surface p-1.5 opacity-0 shadow-xl transition-all duration-150 group-hover/prov:pointer-events-auto group-hover/prov:translate-y-0 group-hover/prov:opacity-100 group-focus-within/prov:pointer-events-auto group-focus-within/prov:translate-y-0 group-focus-within/prov:opacity-100">
        {sources.map((p) => (
          <a
            key={`${p.source}:${p.source_url}`}
            href={p.source_url}
            target="_blank"
            rel="noreferrer"
            title={p.source_url}
            className="flex items-center justify-between gap-2 rounded px-2 py-1 font-mono text-[10px] text-muted hover:bg-hover hover:text-fg"
          >
            <span className="truncate">
              {p.source_label}
              {p.as_of ? ` · as of ${p.as_of}` : ''}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <span className={cn(p.cache === 'live' ? 'text-success' : 'text-dim')}>{p.cache}</span>
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
