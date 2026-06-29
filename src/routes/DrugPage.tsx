import type { ReactNode } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  Receipt,
  PackageCheck,
  ScrollText,
  Replace,
  Pill,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { z } from 'zod'
import { AppShell } from '@/components/AppShell'
import { SegmentedNav } from '@/components/SegmentedNav'
import { Center } from '@/components/Center'
import { CopyAsApi } from '@/components/copy-as-api/CopyAsApi'
import { Spotlight } from '@/components/Spotlight'
import { DrugHero } from '@/components/DrugHero'
import { SummaryCard } from '@/components/SummaryCard'
import { StatusChip } from '@/components/StatusChip'
import { IdentityDetail } from '@/components/details/IdentityDetail'
import { CostDetail } from '@/components/details/CostDetail'
import { SupplyDetail } from '@/components/details/SupplyDetail'
import { LabelDetail } from '@/components/details/LabelDetail'
import { AlternativesDetail } from '@/components/details/AlternativesDetail'
import { useDrug } from '@/hooks/useDrug'
import { DRUGS, DRUG_BY_SLUG, drugLabel } from '@/core/drugs'
import { SHORTAGE_SEM, SHORTAGE_LABEL } from '@/lib/status'
import type { DrugQuery } from '@/core/query'
import type { Provenance } from '@/core/provenance'
import type { Drug } from '@/core/schema'
import { usd } from '@/lib/money'

export const navigatorSearch = z.object({
  drug: z.string().optional(),
  view: z.enum(['all', 'identity', 'cost', 'supply', 'label', 'alternatives']).default('all'),
})
export type NavigatorSearch = z.infer<typeof navigatorSearch>
type View = NavigatorSearch['view']

export function navigatorSearchSchema(search: Record<string, unknown>): NavigatorSearch {
  return navigatorSearch.parse(search)
}

const routeApi = getRouteApi('/')
const SLUGS = DRUGS.map((d) => d.slug)

const ICONS: Record<Exclude<View, 'all'>, LucideIcon> = {
  identity: Pill,
  cost: Receipt,
  supply: PackageCheck,
  label: ScrollText,
  alternatives: Replace,
}

const container = { show: { transition: { staggerChildren: 0.06 } } }
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const } },
}

interface SpotlightConfig {
  title: string
  layoutId?: string
  icon: LucideIcon
  query: DrugQuery
  cite?: Provenance
  body: ReactNode
}

function spotlightFor(view: View, drug: Drug, onPick: (slug: string) => void): SpotlightConfig | null {
  const id = drug.drug_id
  switch (view) {
    case 'identity':
      return {
        title: 'Identity & sources',
        icon: ICONS.identity,
        query: { resource: 'drug', id },
        cite: drug.meta.sources[0],
        body: <IdentityDetail drug={drug} />,
      }
    case 'cost':
      return {
        title: 'Cost reality',
        layoutId: 'card-cost',
        icon: ICONS.cost,
        query: { resource: 'cost', id },
        cite: drug.cost.provenance[0],
        body: <CostDetail drug={drug} />,
      }
    case 'supply':
      return {
        title: 'Live supply',
        layoutId: 'card-supply',
        icon: ICONS.supply,
        query: { resource: 'shortage', id },
        cite: drug.shortage.provenance,
        body: <SupplyDetail drug={drug} />,
      }
    case 'label':
      return {
        title: 'Label facts',
        layoutId: 'card-label',
        icon: ICONS.label,
        query: { resource: 'label', id },
        cite: drug.label.provenance[0],
        body: <LabelDetail drug={drug} />,
      }
    case 'alternatives':
      return {
        title: 'Same-class alternatives',
        layoutId: 'card-alternatives',
        icon: ICONS.alternatives,
        query: { resource: 'alternatives', id },
        cite: drug.alternatives.provenance[0],
        body: <AlternativesDetail drug={drug} onPick={onPick} />,
      }
    default:
      return null
  }
}

export function DrugPage() {
  const { drug: drugParam, view } = routeApi.useSearch()
  const navigate = useNavigate({ from: '/' })
  const set = (patch: Partial<NavigatorSearch>) => navigate({ search: (prev) => ({ ...prev, ...patch }) })

  const slug = drugParam && DRUG_BY_SLUG[drugParam] ? drugParam : SLUGS[0]
  const seed = DRUG_BY_SLUG[slug]
  const { data: drug, isLoading, error } = useDrug(slug)

  const subnav = (
    <SegmentedNav
      items={SLUGS}
      value={slug}
      onChange={(s) => set({ drug: s, view: 'all' })}
      layoutId="drug-pill"
      mono
      label={(s) => drugLabel(DRUG_BY_SLUG[s])}
      title={(s) => `${DRUG_BY_SLUG[s].ingredient} · ${DRUG_BY_SLUG[s].marketed_for}`}
    />
  )
  const actions = drug ? (
    <CopyAsApi query={{ resource: 'drug', id: slug }} cite={drug.meta.sources[0]} />
  ) : undefined

  if (!drug) {
    return (
      <AppShell subnav={subnav}>
        <div className="relative m-auto min-h-[40vh] w-full max-w-3xl">
          <Center className={error ? 'text-danger' : undefined}>
            {isLoading ? `loading ${drugLabel(seed)}…` : error ? (error as Error).message : 'no data'}
          </Center>
        </div>
      </AppShell>
    )
  }

  const cfg = spotlightFor(view, drug, (s) => set({ drug: s, view: 'all' }))
  const c = drug.cost
  const l = drug.label
  const s = drug.shortage

  return (
    <AppShell subnav={subnav} actions={actions}>
      <motion.div
        key={slug}
        initial="hidden"
        animate="show"
        variants={container}
        className="mx-auto my-auto w-full max-w-3xl space-y-3 p-4"
      >
        <motion.div variants={item}>
          <DrugHero drug={drug} onSources={() => set({ view: 'identity' })} />
        </motion.div>

        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="grid auto-rows-fr gap-3 sm:grid-cols-2"
        >
          <motion.div variants={item} className="h-full">
            <SummaryCard
              title="Cost reality"
              icon={ICONS.cost}
              layoutId="card-cost"
              onClick={() => set({ view: 'cost' })}
            >
              {c.points.length ? (
                <span className="truncate">
                  {usd(c.package_low_usd)}
                  {c.package_high_usd !== c.package_low_usd && <> – {usd(c.package_high_usd)}</>}
                  <span className="text-dim"> / pkg</span>
                </span>
              ) : (
                <span className="text-dim truncate">{c.coverage_note ?? 'no NADAC rows'}</span>
              )}
            </SummaryCard>
          </motion.div>

          <motion.div variants={item} className="h-full">
            <SummaryCard
              title="Live supply"
              icon={ICONS.supply}
              layoutId="card-supply"
              onClick={() => set({ view: 'supply' })}
            >
              <StatusChip
                sem={SHORTAGE_SEM[s.status]}
                label={SHORTAGE_LABEL[s.status]}
                strike={s.status === 'discontinued'}
                pulse={s.status === 'available'}
              />
              <span className="text-dim">
                {s.update_date ? `as of ${s.update_date}` : 'no active shortage'}
              </span>
            </SummaryCard>
          </motion.div>

          <motion.div variants={item} className="h-full">
            <SummaryCard
              title="Label facts"
              icon={ICONS.label}
              layoutId="card-label"
              onClick={() => set({ view: 'label' })}
            >
              <span className="truncate">
                {l.quotes.length} section{l.quotes.length === 1 ? '' : 's'} · {l.faers_top_reactions.length}{' '}
                reactions
              </span>
              {drug.identity.has_boxed_warning && (
                <span title="Boxed warning" className="inline-flex shrink-0">
                  <AlertTriangle className="text-danger h-3.5 w-3.5" />
                </span>
              )}
            </SummaryCard>
          </motion.div>

          <motion.div variants={item} className="h-full">
            <SummaryCard
              title="Same-class alternatives"
              icon={ICONS.alternatives}
              layoutId="card-alternatives"
              onClick={() => set({ view: 'alternatives' })}
            >
              <span className="truncate">
                {drug.alternatives.same_class.length} same-class option
                {drug.alternatives.same_class.length === 1 ? '' : 's'}
              </span>
            </SummaryCard>
          </motion.div>
        </motion.div>

        {/* data-behind-viz: the drug record is always in the DOM for agents */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Dataset',
              name: `${drug.identity.brand_name} — loupe`,
              distribution: { '@type': 'DataDownload', contentUrl: `/v1/drugs/${slug}` },
            }).replace(/</g, '\\u003c'),
          }}
        />
      </motion.div>

      <Spotlight
        open={Boolean(cfg)}
        onClose={() => set({ view: 'all' })}
        layoutId={cfg?.layoutId}
        icon={cfg?.icon}
        title={cfg?.title ?? ''}
        subtitle={drug.identity.brand_name}
        query={cfg?.query}
        cite={cfg?.cite}
      >
        {cfg?.body}
      </Spotlight>
    </AppShell>
  )
}
