import { AlertTriangle, Boxes } from 'lucide-react'
import type { Drug } from '@/core/schema'
import { StatusChip } from '@/components/StatusChip'
import { DetailShell } from '@/components/details/DetailShell'
import { Field, SectionLabel, InfoTip } from '@/components/ui'
import { SHORTAGE_SEM, SHORTAGE_LABEL } from '@/lib/status'

export function SupplyDetail({ drug }: { drug: Drug }) {
  const s = drug.shortage
  const presentations = s.presentations_affected
  return (
    <DetailShell prov={s.provenance}>
      <div>
        <div className="flex items-center gap-2">
          <StatusChip
            sem={SHORTAGE_SEM[s.status]}
            label={SHORTAGE_LABEL[s.status]}
            strike={s.status === 'discontinued'}
            pulse={s.status === 'available'}
          />
          <InfoTip>{s.disclaimer}</InfoTip>
        </div>
        <div className="text-dim mt-1.5 text-[11px]">FDA national status — your pharmacy may differ.</div>
      </div>

      {s.status === 'available' && !s.update_date && (
        <div className="text-muted text-[12px]">No active FDA shortage record for this brand.</div>
      )}

      {s.reason && (
        <div>
          <SectionLabel icon={AlertTriangle}>reason · verbatim</SectionLabel>
          <p className="text-muted mt-1 text-[12px] whitespace-pre-wrap">{s.reason}</p>
        </div>
      )}
      {s.resupply_estimate && (
        <div>
          <SectionLabel>availability · verbatim</SectionLabel>
          <p className="text-muted mt-1 text-[12px] whitespace-pre-wrap">{s.resupply_estimate}</p>
        </div>
      )}
      {presentations.length > 0 && (
        <div>
          <SectionLabel icon={Boxes}>presentations affected · {presentations.length}</SectionLabel>
          <ul className="mt-1 space-y-0.5">
            {presentations.slice(0, 5).map((p) => (
              <li key={p} className="text-muted font-mono text-[11px]">
                {p}
              </li>
            ))}
            {presentations.length > 5 && (
              <li className="text-dim font-mono text-[11px]">+{presentations.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="First posted" value={s.initial_posting_date ?? '—'} />
        <Field label="Last updated" value={s.update_date ?? '—'} />
      </div>
    </DetailShell>
  )
}
