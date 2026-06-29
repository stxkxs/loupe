import { Receipt } from 'lucide-react'
import type { Drug, CostPoint } from '@/core/schema'
import { DataTable, type Column } from '@/components/DataTable'
import { DetailShell } from '@/components/details/DetailShell'
import { CountUp } from '@/components/CountUp'
import { SectionLabel, InfoTip } from '@/components/ui'
import { costColor } from '@/lib/costRamp'
import { usd } from '@/lib/money'

export function CostDetail({ drug }: { drug: Drug }) {
  const c = drug.cost
  const pkgCosts = c.points.map((p) => p.est_package_cost_usd).filter((n): n is number => n != null)
  const min = pkgCosts.length ? Math.min(...pkgCosts) : 0
  const max = pkgCosts.length ? Math.max(...pkgCosts) : 0
  const monthly = c.points.find((p) => p.est_monthly_cost_usd != null)

  const columns: Column<CostPoint>[] = [
    { key: 'description', label: 'package' },
    {
      key: 'nadac_per_unit_usd',
      label: '$/unit',
      align: 'right',
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          {r.est_package_cost_usd != null && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: costColor(r.est_package_cost_usd, min, max) }}
              aria-hidden="true"
            />
          )}
          {usd(r.nadac_per_unit_usd)}
          <span className="text-dim">/{r.pricing_unit ?? '?'}</span>
        </span>
      ),
    },
    { key: 'est_package_cost_usd', label: 'pkg', align: 'right', render: (r) => usd(r.est_package_cost_usd) },
    { key: 'effective_date', label: 'as of', align: 'right' },
  ]

  return (
    <DetailShell prov={c.provenance}>
      <div>
        <SectionLabel icon={Receipt}>acquisition cost / package</SectionLabel>
        {c.points.length ? (
          <div className="text-fg mt-1 font-mono text-[22px] font-semibold tabular-nums">
            <CountUp value={c.package_low_usd} format={usd} />
            {c.package_high_usd !== c.package_low_usd && (
              <>
                {' – '}
                <CountUp value={c.package_high_usd} format={usd} />
              </>
            )}
          </div>
        ) : (
          <div className="text-muted mt-1 text-[13px]">{c.coverage_note}</div>
        )}
        {monthly && (
          <div className="text-muted mt-0.5 flex items-center gap-1 font-mono text-[11px]">
            ≈ <CountUp value={monthly.est_monthly_cost_usd} format={usd} />
            /mo est.
            <InfoTip>{monthly.est_monthly_method}</InfoTip>
          </div>
        )}
        <div className="text-primary mt-1.5 flex items-center gap-1 text-[11px]">
          NADAC = pharmacy acquisition cost, not your copay
          <InfoTip>{c.disclaimer}</InfoTip>
        </div>
      </div>

      {c.points.length > 0 && <DataTable columns={columns} rows={c.points} />}

      {c.medicare_context && (
        <div className="text-dim flex items-center gap-1 font-mono text-[11px]">
          Part D {c.medicare_context.year}: {usd(c.medicare_context.total_spending_usd)} program spend
          <InfoTip>
            National Medicare Part D program spend over{' '}
            {c.medicare_context.total_claims?.toLocaleString() ?? '—'} claims — context, not a patient price.
          </InfoTip>
        </div>
      )}
    </DetailShell>
  )
}
