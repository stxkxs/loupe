import { useId, type ReactNode } from 'react'
import { Info, Copy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/toast/ToastProvider'

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="text-dim font-mono text-[10px] tracking-wide uppercase">{children}</div>
}

/** A section header: an icon + a quiet uppercase label. Keeps every detail on one rhythm. */
export function SectionLabel({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="text-dim flex items-center gap-1.5 font-mono text-[10px] tracking-wide uppercase">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </div>
  )
}

/** A labeled value. `truncate` for single-line mono values; default wraps for verbatim text. */
export function Field({
  label,
  value,
  truncate,
  title,
}: {
  label: string
  value: string
  truncate?: boolean
  title?: string
}) {
  return (
    <div className="min-w-0">
      <Kicker>{label}</Kicker>
      <div
        className={cn(
          'text-fg font-mono text-[12px] tabular-nums',
          truncate ? 'truncate' : 'whitespace-pre-wrap',
        )}
        title={title ?? (truncate ? value : undefined)}
      >
        {value}
      </div>
    </div>
  )
}

/** A small info affordance — the full/legal text shows in a hover/focus popover but stays in
 *  the a11y tree (opacity-hidden, not visibility:hidden) and is announced via aria-describedby. */
export function InfoTip({ children, className }: { children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <span className={cn('group/tip relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label="more information"
        aria-describedby={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
        className="text-dim hover:text-fg inline-flex items-center"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        id={id}
        role="tooltip"
        className="border-border bg-surface text-muted pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-64 max-w-[70vw] -translate-x-1/2 translate-y-1 rounded-md border p-2 text-[11px] leading-snug opacity-0 shadow-lg transition-all duration-150 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}

/** A click-to-copy value (IDs, codes) — reveals a copy glyph on hover, toasts on copy. */
export function CopyValue({
  value,
  label,
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast(`Copied ${label ?? value}`)
        } catch {
          toast('Copy failed', 'info')
        }
      }}
      className={cn(
        'group/cv hover:text-fg inline-flex items-center gap-1 font-mono tabular-nums',
        className,
      )}
    >
      {value}
      <Copy
        className="text-dim h-3 w-3 opacity-0 transition-opacity group-hover/cv:opacity-100"
        aria-hidden="true"
      />
    </button>
  )
}
