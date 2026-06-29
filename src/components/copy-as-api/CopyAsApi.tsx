import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Code2, Check, Copy, X } from 'lucide-react'
import { toApiCall, citeSource, type DrugQuery } from '@/core/query'
import type { Provenance } from '@/core/provenance'
import { useToast } from '@/components/toast/ToastProvider'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { cn } from '@/lib/utils'

type Tab = 'curl' | 'python' | 'ts' | 'link' | 'cite'

// Copy-as-API on every panel (SPEC §signature_moves): one DrugQuery → the API url, the
// shareable deep-link, and the curl/python/ts snippets are provably the same call. The
// "cite" tab renders from a Provenance (citeSource), not from toApiCall.
export function CopyAsApi({ query, cite }: { query: DrugQuery; cite?: Provenance }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('curl')
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const toast = useToast()
  const close = useCallback(() => setOpen(false), [])
  useFocusTrap(open, dialogRef, close)

  const call = toApiCall(query)
  const tabs: { id: Tab; label: string; text: string }[] = [
    { id: 'curl', label: 'curl', text: call.curl },
    { id: 'python', label: 'python', text: call.python },
    { id: 'ts', label: 'ts', text: call.ts },
    { id: 'link', label: 'deep-link', text: call.deepLink },
    ...(cite ? [{ id: 'cite' as Tab, label: 'cite', text: citeSource(cite).apa }] : []),
  ]
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.text)
      setCopied(true)
      toast(`Copied ${active.label} to clipboard`)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast('Copy failed', 'info')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Copy this panel as an API call"
        className="border-border text-dim hover:text-fg flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors"
      >
        <Code2 className="h-3.5 w-3.5" />
        copy as API
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Copy this panel as an API call"
                className="border-border bg-surface w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl outline-none"
              >
                <div className="border-border flex items-center justify-between border-b px-3.5 py-2.5">
                  <div className="flex items-center gap-1">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        aria-pressed={t.id === tab}
                        className={cn(
                          'cursor-pointer rounded-md px-2 py-0.5 font-mono text-[11px]',
                          t.id === tab ? 'bg-primary/15 text-primary' : 'text-dim hover:text-fg',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-dim hover:text-fg"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative">
                  <pre className="text-fg max-h-[50vh] overflow-auto p-3.5 font-mono text-[11.5px] break-all whitespace-pre-wrap">
                    {active.text}
                  </pre>
                  <button
                    type="button"
                    onClick={copy}
                    className="border-border bg-surface text-dim hover:text-fg absolute top-2 right-2 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                  >
                    {copied ? <Check className="text-success h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'copied' : 'copy'}
                  </button>
                </div>
                <div className="border-border text-dim border-t px-3.5 py-2 text-[10px]">
                  Keyless read API · the same data this panel renders · not medical advice
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
