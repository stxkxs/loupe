import type { Drug } from '@/core/schema'
import { DetailShell } from '@/components/details/DetailShell'
import { Field, CopyValue, Kicker } from '@/components/ui'

export function IdentityDetail({ drug }: { drug: Drug }) {
  const id = drug.identity
  const classes = id.classes.filter((c) => c.class_type === 'ATC1-4' || c.class_type === 'EPC')
  return (
    <DetailShell prov={id.provenance}>
      {classes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <span
              key={`${c.class_type}:${c.class_id}`}
              title={`${c.class_type} · ${c.class_id}`}
              className="bg-primary/10 text-primary rounded-md px-2 py-0.5 font-mono text-[11px]"
            >
              {c.class_name}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <Kicker>RxCUI</Kicker>
          <CopyValue value={id.rxcui} label="RxCUI" className="text-fg text-[12px]" />
        </div>
        <Field label="Manufacturer" value={id.manufacturer ?? '—'} truncate />
        <Field label="Routes" value={id.routes.join(', ') || '—'} truncate />
        <Field label="Strengths" value={id.strengths.slice(0, 8).join(' · ') || '—'} />
      </div>
    </DetailShell>
  )
}
