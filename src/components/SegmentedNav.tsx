import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface Props<T extends string> {
  items: readonly T[]
  value: T
  onChange: (value: T) => void
  /** unique id so the active pill animates only within this group */
  layoutId: string
  mono?: boolean
  uppercase?: boolean
  activePill?: string
  activeText?: string
  /** render a friendly label for an item while keeping the value stable */
  label?: (value: T) => string
  title?: (value: T) => string
}

/**
 * Pill-style segmented control with a sliding active indicator (motion `layoutId`).
 * `label` added so drug slugs can show brand names.
 */
export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  layoutId,
  mono = false,
  uppercase = false,
  activePill = 'bg-primary/15',
  activeText = 'text-primary',
  label,
  title,
}: Props<T>) {
  return (
    <div className="flex items-center gap-0.5">
      {items.map((it) => (
        <motion.button
          key={it}
          type="button"
          onClick={() => onChange(it)}
          aria-pressed={it === value}
          whileTap={{ scale: 0.96 }}
          title={title?.(it)}
          className={cn(
            'relative cursor-pointer rounded-md px-2.5 py-1 text-[11px] whitespace-nowrap',
            mono && 'font-mono',
            uppercase && 'uppercase',
          )}
        >
          {it === value && (
            <motion.span
              layoutId={layoutId}
              className={cn('absolute inset-0 rounded-md', activePill)}
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span
            className={cn(
              'relative z-10 transition-colors',
              it === value ? activeText : 'text-dim hover:text-fg',
            )}
          >
            {label?.(it) ?? it}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
