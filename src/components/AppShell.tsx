import type { ReactNode } from 'react'
import { SOURCES } from '@/core/sources'
import { GUARDRAILS } from '@/core/guardrails'
import { ThemeToggle } from '@/components/ThemeToggle'

const SOURCE_LINE = ['openfda_label', 'rxnorm', 'rxclass', 'nadac', 'dailymed']
  .map((id) => SOURCES[id as keyof typeof SOURCES].label.replace(/ \(.*\)$/, ''))
  .join(' · ')

/**
 * The app chrome: the `loupe` wordmark + tagline, the sources line (provenance made
 * visible, top-level), a nav slot, a global actions slot, and the always-on
 * not-medical-advice / not-affiliated disclosure footer (guardrail creed, layer 1).
 */
export function AppShell({
  nav,
  subnav,
  actions,
  children,
}: {
  nav?: ReactNode
  subnav?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-screen flex-col bg-bg">
      <div className="h-[3px] shrink-0 bg-brand-gradient" />
      <header className="flex items-center gap-4 border-b border-border px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[19px] font-semibold tracking-tight text-primary">loupe</span>
          <span className="hidden text-[12px] text-dim sm:inline">appraise the real value</span>
        </div>
        {nav && <nav className="ml-2">{nav}</nav>}
        <div className="ml-auto flex items-center gap-3">
          <span
            className="hidden font-mono text-[10px] tracking-wide text-dim uppercase lg:inline"
            title="Every figure on this page is sourced and timestamped against these public datasets"
          >
            {SOURCE_LINE}
          </span>
          {actions}
          <ThemeToggle />
        </div>
      </header>

      {subnav && (
        <div className="overflow-x-auto border-b border-border px-5 py-1.5">
          <div className="w-max">{subnav}</div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</main>

      <footer className="border-t border-border px-5 py-1.5 text-[10px] text-dim">{GUARDRAILS.notMedicalAdvice}</footer>
    </div>
  )
}
