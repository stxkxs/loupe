import { useEffect, useRef, type RefObject } from 'react'

/**
 * Modal-dialog a11y for a portal/overlay. When `active` flips true it focuses the container,
 * traps Tab within it, closes on Escape, and restores focus to the previously-active element
 * on teardown. `onClose` is held in a ref so the trap re-arms only on open/close — not on
 * every parent render (which would otherwise steal focus back to the container mid-interaction).
 */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return
    const restoreTo = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      restoreTo?.focus()
    }
  }, [active, ref])
}
