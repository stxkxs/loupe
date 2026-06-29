import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Info } from 'lucide-react'

const MAX_TOASTS = 4

type Tone = 'success' | 'info'
interface Toast {
  id: number
  message: string
  tone: Tone
}

const ToastCtx = createContext<(message: string, tone?: Tone) => void>(() => {})

/** Fire a transient confirmation toast — e.g. after copy-as-API. */
export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const push = useCallback((message: string, tone: Tone = 'success') => {
    const id = ++idRef.current
    // cap the stack so a burst of copies can't grow it unboundedly (drop the oldest)
    setToasts((t) => [...t, { id, message, tone }].slice(-MAX_TOASTS))
    const handle = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
      timers.current.delete(handle)
    }, 2600)
    timers.current.add(handle)
  }, [])

  // clear any pending dismissals on unmount (matters for tests that mount/unmount the provider)
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                role="status"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
                className="border-border bg-surface text-fg pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] shadow-lg"
              >
                {t.tone === 'success' ? (
                  <Check className="text-primary h-3.5 w-3.5" />
                ) : (
                  <Info className="text-muted h-3.5 w-3.5" />
                )}
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
