import { cn } from '@/lib/utils'
import type { Semantic } from '@/lib/status'

// The one badge primitive (SPEC §component_kit) — the active-pill recipe the house
// kept re-inventing, standardized. Status is encoded by dot + text label, never by
// color alone (a11y: non-color-only encoding).
const PILL: Record<Semantic, string> = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  primary: 'bg-primary/15 text-primary',
  dim: 'bg-hover text-dim',
}
const DOT: Record<Semantic, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  primary: 'bg-primary',
  dim: 'bg-dim',
}

export function StatusChip({
  sem,
  label,
  strike,
  title,
  pulse,
}: {
  sem: Semantic
  label: string
  strike?: boolean
  title?: string
  /** breathe the dot — a resting pulse for "live/available"; frozen (off) reads as stopped */
  pulse?: boolean
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] whitespace-nowrap',
        PILL[sem],
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[sem], pulse && 'dot-breathe')} aria-hidden="true" />
      <span className={cn(strike && 'line-through')}>{label}</span>
    </span>
  )
}
