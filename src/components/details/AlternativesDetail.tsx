import { ArrowRight } from 'lucide-react'
import type { Drug } from '@/core/schema'
import { DetailShell } from '@/components/details/DetailShell'
import { InfoTip } from '@/components/ui'

export function AlternativesDetail({ drug, onPick }: { drug: Drug; onPick: (slug: string) => void }) {
  const a = drug.alternatives
  return (
    <DetailShell prov={a.provenance} body="space-y-3">
      <div className="text-muted flex items-center gap-1 text-[11px]">
        Informational only — discuss any change with your care team
        <InfoTip>{a.clinician_gate}</InfoTip>
      </div>
      {a.same_class.length ? (
        <div className="grid gap-1.5">
          {a.same_class.map((alt) => (
            <div
              key={alt.rxcui}
              className="border-border bg-surface-2 flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
            >
              <div className="min-w-0">
                <div className="text-fg truncate font-mono text-[12px]">{alt.generic_name}</div>
                <div className="text-dim truncate font-mono text-[10px] tracking-wide uppercase">
                  {alt.shared_class}
                </div>
              </div>
              {alt.in_registry && alt.drug_id ? (
                <button
                  type="button"
                  onClick={() => onPick(alt.drug_id as string)}
                  className="border-border text-primary hover:bg-hover flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                >
                  view <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-dim shrink-0 font-mono text-[10px]">RxCUI {alt.rxcui}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-dim px-1 py-6 text-center text-[12px]">
          No same-class peers found in RxClass.
        </div>
      )}
    </DetailShell>
  )
}
