import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'
const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => supported && window.matchMedia(QUERY).matches)
  useEffect(() => {
    if (!supported) return
    const m = window.matchMedia(QUERY)
    const on = () => setReduce(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduce
}
