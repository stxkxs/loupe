import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Absolutely-centered overlay message for loading / error / empty / stale states. */
export function Center({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center px-6 text-center text-[12px] text-dim',
        className,
      )}
    >
      {children}
    </div>
  )
}
