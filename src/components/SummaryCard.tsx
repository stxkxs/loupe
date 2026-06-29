import { motion } from 'motion/react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// A compact, tappable overview card. Shares a `layoutId` with its Spotlight detail, so a
// tap morphs the card into the focused view (shared-layout magic move).
export function SummaryCard({
  title,
  icon: Icon,
  layoutId,
  onClick,
  children,
}: {
  title: string
  icon: LucideIcon
  layoutId: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="group flex h-full min-h-[78px] w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-shadow duration-200 hover:shadow-sm"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-dim transition-colors duration-200 group-hover:text-primary" />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-tight text-fg">{title}</div>
          {/* one line only — keeps every card the same height */}
          <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden font-mono text-[12px] whitespace-nowrap text-muted">
            {children}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-fg" />
    </motion.button>
  )
}
