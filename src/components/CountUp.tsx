import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

// A value that counts up from 0 and settles — a monitor coming to rest, not a slot reel.
// Tabular figures (caller's class) so nothing jitters; snaps to final under reduced-motion.
export function CountUp({
  value,
  format,
  durationMs = 700,
  className,
}: {
  value: number | null | undefined
  format: (n: number | null | undefined) => string
  durationMs?: number
  className?: string
}) {
  const reduce = usePrefersReducedMotion()
  const animate = value != null && !reduce
  const [display, setDisplay] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    if (!animate) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setDisplay(value * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, durationMs, animate])

  // static (null or reduced-motion) renders the real value directly — no animation state
  return <span className={className}>{format(animate ? display : value)}</span>
}
