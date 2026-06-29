import { lazy, Suspense, useMemo, type ReactNode } from 'react'
import { type EChartsOption } from 'echarts'
import { AlertTriangle, ScrollText, Activity, type LucideIcon } from 'lucide-react'
import type { Drug, LabelQuote } from '@/core/schema'
import { DetailShell } from '@/components/details/DetailShell'
import { SectionLabel, InfoTip } from '@/components/ui'

const EChart = lazy(() => import('@/components/charts/EChart').then((m) => ({ default: m.EChart })))

const SECTION_ICON: Record<LabelQuote['section'], LucideIcon> = {
  boxed_warning: AlertTriangle,
  dosage_and_administration: ScrollText,
  adverse_reactions: Activity,
  indications_and_usage: ScrollText,
  warnings: AlertTriangle,
}

function withHighlight(text: string, hl: string | null): ReactNode {
  if (!hl) return text
  const i = text.indexOf(hl)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark
        className="bg-primary/15 text-fg rounded px-0.5"
        title="Missed-dose guidance — quoted verbatim from the label"
      >
        {hl}
      </mark>
      {text.slice(i + hl.length)}
    </>
  )
}

export function LabelDetail({ drug }: { drug: Drug }) {
  const l = drug.label
  const reactions = useMemo(() => [...l.faers_top_reactions].reverse(), [l.faers_top_reactions])
  // Build the chart option once per drug (not per render). Reading the live theme tokens
  // inside the memo keeps getComputedStyle out of the hot render path; on a theme toggle the
  // chart re-paints with the new tokens when the spotlight is reopened.
  const faersOption = useMemo<EChartsOption>(() => {
    const css = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null
    const axisColor = css?.getPropertyValue('--color-muted').trim() || '#5f5b53'
    const barColor = css?.getPropertyValue('--color-primary').trim() || '#4d5cc9'
    return {
      grid: { left: 4, right: 36, top: 4, bottom: 4, containLabel: true },
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: reactions.map((r) => r.reaction),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: axisColor, fontFamily: 'Spline Sans Mono Variable', fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: reactions.map((r) => r.report_count),
          itemStyle: { color: barColor, borderRadius: [0, 2, 2, 0] },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            color: axisColor,
            fontFamily: 'Spline Sans Mono Variable',
            fontSize: 10,
          },
          barWidth: '62%',
        },
      ],
    }
  }, [reactions])

  return (
    <DetailShell prov={l.provenance}>
      {l.quotes.map((q, i) => (
        <div key={`${q.section}-${i}`}>
          <SectionLabel icon={SECTION_ICON[q.section]}>{q.section.replace(/_/g, ' ')}</SectionLabel>
          <blockquote className="border-border text-muted mt-1 border-l-2 pl-2.5 text-[12px] whitespace-pre-wrap">
            {withHighlight(q.text, q.highlight)}
            {q.truncated && <span className="text-dim"> …(truncated — open the source)</span>}
          </blockquote>
        </div>
      ))}

      {l.faers_top_reactions.length > 0 && (
        <div>
          <SectionLabel icon={Activity}>
            most-reported reactions
            {l.faers_total_reports ? ` · ${l.faers_total_reports.toLocaleString()} reports` : ''}
            <InfoTip>{l.faers_disclaimer}</InfoTip>
          </SectionLabel>
          <div className="text-dim mt-0.5 text-[10px]">spontaneous reports — not incidence rates</div>
          <div className="mt-1">
            <Suspense
              fallback={<div className="text-dim px-1 py-3 font-mono text-[10px]">loading chart…</div>}
            >
              <EChart
                option={faersOption}
                height={Math.min(260, 24 + reactions.length * 22)}
                ariaLabel={`Most-reported adverse reactions for ${drug.identity.brand_name}: ${l.faers_top_reactions
                  .slice(0, 3)
                  .map((r) => `${r.reaction} ${r.report_count} reports`)
                  .join(', ')}`}
              />
            </Suspense>
            <table className="sr-only">
              <caption>FAERS reaction report counts</caption>
              <thead>
                <tr>
                  <th>Reaction</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                {l.faers_top_reactions.map((r) => (
                  <tr key={r.reaction}>
                    <td>{r.reaction}</td>
                    <td>{r.report_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-dim flex items-center gap-1 text-[11px]">
        FDA label · quoted verbatim
        <InfoTip>{l.label_disclaimer}</InfoTip>
      </div>
    </DetailShell>
  )
}
