import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, Link2, type LucideIcon } from 'lucide-react'
import { queryUrl, deepLink, type DrugQuery } from '@/core/query'
import type { Provenance } from '@/core/provenance'
import { CopyAsApi } from '@/components/copy-as-api/CopyAsApi'
import { useToast } from '@/components/toast/ToastProvider'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// The drill-down "spotlight": a centered focus card the summary card morphs INTO (shared
// `layoutId`). Dims the page; ESC / tap-out / close morphs it back. Bakes in the agent-ready
// trio for the view (copy-as-API, a share-the-deep-link button, an inline JSON-LD Dataset).
export function Spotlight({
  open,
  onClose,
  layoutId,
  icon: Icon,
  title,
  subtitle,
  query,
  cite,
  children,
}: {
  open: boolean
  onClose: () => void
  layoutId?: string
  icon?: LucideIcon
  title: string
  subtitle?: string
  query?: DrugQuery
  cite?: Provenance
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const toast = useToast()
  useFocusTrap(open, panelRef, onClose)

  const shareLink = async () => {
    if (!query) return
    try {
      await navigator.clipboard.writeText(deepLink(query))
      toast('Link copied')
    } catch {
      toast('Copy failed', 'info')
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <motion.div
            ref={panelRef}
            layoutId={layoutId}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={layoutId ? undefined : { opacity: 0, scale: 0.96 }}
            animate={layoutId ? undefined : { opacity: 1, scale: 1 }}
            exit={layoutId ? undefined : { opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="border-border bg-surface flex max-h-[86vh] w-[600px] max-w-[94vw] flex-col overflow-hidden rounded-xl border shadow-2xl outline-none"
          >
            <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {Icon && <Icon className="text-primary h-4 w-4 shrink-0" />}
                <div className="min-w-0">
                  <h2 className="font-display truncate text-[15px] font-semibold tracking-tight">{title}</h2>
                  {subtitle && <div className="text-dim truncate font-mono text-[11px]">{subtitle}</div>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {query && (
                  <button
                    type="button"
                    onClick={shareLink}
                    title="Copy a link to this view"
                    className="text-dim hover:bg-hover hover:text-fg rounded-md p-1.5"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>
                )}
                {query && <CopyAsApi query={query} cite={cite} />}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="text-dim hover:bg-hover hover:text-fg rounded-md p-1.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            {/* fade the detail in just after the morph settles so the content swap is hidden */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.18 }}
              className="min-h-0 flex-1 overflow-auto"
            >
              {children}
            </motion.div>
            {query && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'Dataset',
                    name: `${title} — loupe`,
                    distribution: { '@type': 'DataDownload', contentUrl: queryUrl(query) },
                  }).replace(/</g, '\\u003c'),
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
