import type { Drug } from '@/core/schema'
import { StatusChip } from '@/components/StatusChip'
import { CountUp } from '@/components/CountUp'
import { PixelGlimmer } from '@/components/PixelGlimmer'
import { APPROVAL_SEM, SHORTAGE_SEM, SHORTAGE_LABEL } from '@/lib/status'
import { usd } from '@/lib/money'

// The at-a-glance hero: name + headline cost on the top row, then the chips flow across the
// FULL width beneath them so long class names pack tightly instead of stranding on a line.
export function DrugHero({ drug, onSources }: { drug: Drug; onSources: () => void }) {
  const id = drug.identity
  const c = drug.cost
  const classes = id.classes.filter((cl) => cl.class_type === 'ATC1-4' || cl.class_type === 'EPC')

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-surface p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.16]" aria-hidden="true" />
      {/* one-time pixelated glimmer on drug switch (the hero re-mounts per slug) */}
      <PixelGlimmer />

      <div className="relative space-y-4">
        {/* top row: identity left, headline cost right */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] leading-none font-semibold tracking-tight text-fg">
              {id.brand_name}
            </h1>
            <div className="mt-2 font-mono text-[12px] text-muted">
              {id.brand_name === id.generic_name ? id.generic_name : `${id.generic_name} · RxCUI ${id.rxcui}`}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="font-mono text-[10px] tracking-wide text-dim uppercase">acquisition cost / package</div>
            {c.points.length ? (
              <div className="mt-1.5 font-mono text-[28px] leading-none font-semibold text-fg tabular-nums">
                <CountUp value={c.package_low_usd} format={usd} />
                {c.package_high_usd !== c.package_low_usd && (
                  <>
                    {' – '}
                    <CountUp value={c.package_high_usd} format={usd} />
                  </>
                )}
              </div>
            ) : (
              <div className="mt-1.5 font-mono text-[15px] text-muted">{c.coverage_note ?? '—'}</div>
            )}
            <div className="mt-2 text-[11px] text-dim">NADAC acquisition · not your copay</div>
          </div>
        </div>

        {/* chips — full width so they flow instead of stranding */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            sem={APPROVAL_SEM[id.approval_status]}
            label={id.approval_status === 'approved' ? 'FDA-approved' : id.approval_status}
          />
          {id.has_boxed_warning && <StatusChip sem="danger" label="Boxed warning" />}
          <StatusChip
            sem={SHORTAGE_SEM[drug.shortage.status]}
            label={SHORTAGE_LABEL[drug.shortage.status]}
            strike={drug.shortage.status === 'discontinued'}
            pulse={drug.shortage.status === 'available'}
          />
          {classes.map((cl) => (
            <span
              key={`${cl.class_type}:${cl.class_id}`}
              title={`${cl.class_type} · ${cl.class_id}`}
              className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
            >
              {cl.class_name}
            </span>
          ))}
        </div>

        <button type="button" onClick={onSources} className="text-[11px] text-primary hover:underline">
          identity &amp; sources →
        </button>
      </div>
    </section>
  )
}
