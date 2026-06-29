// resolveDrug — fan out to every source for one seed drug and compose ONE validated
// `Drug` (SPEC §3). Build/refresh path only (uses fetch); the SPA never imports this.
// Each field carries exact provenance; missing data becomes an honest empty state,
// never a fabricated value.
//
// The returned object OMITS every guardrail literal (cost_basis, disclaimers,
// clinician_gate, …). It is validated with Drug.parse() here (build-time guarantee),
// but the literal-free object is what gets written to the snapshot — so a snapshot can
// never carry a stale/tampered guardrail string; Drug.parse() back-fills them on read.

import { z } from 'zod'
import { Drug, type Cost, type Label, type Shortage, type Alternatives, type Identity } from './schema'
import type { Provenance, SourceId } from './provenance'
import { SOURCES } from './sources'
import type { SeedDrug } from './drugs'
import { DRUGS } from './drugs'
import { yyyymmddToIso, mdyToIso } from './dates'
import { parseUnitsPerPackage, estPackageCost, estMonthly } from './derive'
import { fetchNdc, fetchLabel, fetchShortage, fetchFaers } from './sourcefetch/openfda'
import { fetchClasses, fetchClassMembers } from './sourcefetch/rxnav'
import { fetchNadacForNdc, fetchPartD } from './sourcefetch/cms'
import { dailymedUrl } from './sourcefetch/dailymed'

type DrugInput = z.input<typeof Drug>
const TRUNC = 3500

function prov(
  source: SourceId,
  source_url: string,
  opts: { as_of?: string | null; record_id?: string | null; nowIso: string },
): Provenance {
  return {
    source,
    source_label: SOURCES[source].label,
    source_url,
    retrieved_at: opts.nowIso,
    as_of: opts.as_of ?? null,
    cache: 'cached',
    record_id: opts.record_id ?? null,
  }
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= TRUNC) return { text, truncated: false }
  return { text: text.slice(0, TRUNC).trimEnd() + ' …', truncated: true }
}

function missedDoseSentence(text: string): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const hit = sentences.find((s) => /miss(ed)? (a )?dose|if you (miss|forget)|a dose is missed/i.test(s))
  return hit ? hit.trim() : null
}

function mapShortageStatus(raw: string): Shortage['status'] {
  const s = raw.toLowerCase()
  if (s.includes('resolved')) return 'resolved'
  if (s.includes('discontinu')) return 'discontinued'
  if (s.includes('current') || s.includes('shortage')) return 'in-shortage'
  if (s.includes('available') || s.includes('no shortage')) return 'available'
  return 'limited'
}

export async function resolveDrug(seed: SeedDrug, nowIso: string): Promise<DrugInput> {
  const branded = seed.brand ? { brand: seed.brand, generic: seed.ingredient } : { generic: seed.ingredient }

  const [ndc, label, classes, shortage, faers] = await Promise.all([
    fetchNdc(branded),
    fetchLabel(branded),
    fetchClasses(seed.ingredient_rxcui),
    fetchShortage(branded),
    fetchFaers(branded),
  ])

  // ── Identity ──
  const idProv: Provenance[] = [
    prov('rxnorm', `https://rxnav.nlm.nih.gov/REST/rxcui/${seed.ingredient_rxcui}/properties.json`, {
      record_id: seed.ingredient_rxcui,
      nowIso,
    }),
  ]
  if (classes.classes.length) idProv.push(prov('rxclass', classes.url, { nowIso }))
  if (ndc) idProv.push(prov('openfda_ndc', ndc.url, { nowIso }))
  if (label) idProv.push(prov('openfda_label', label.url, { as_of: yyyymmddToIso(label.effective_time), record_id: label.setid, nowIso }))

  const identity: Identity = {
    brand_name: seed.brand || seed.ingredient,
    generic_name: seed.ingredient,
    rxcui: seed.ingredient_rxcui,
    manufacturer: label?.manufacturer ?? ndc?.manufacturer ?? null,
    approval_status: 'approved', // an SPL exists; never algorithmically derive off-label/withdrawn
    has_boxed_warning: label?.has_boxed_warning ?? false,
    classes: classes.classes.map((c) => ({
      class_id: c.classId,
      class_name: c.className,
      class_type: c.classType as Identity['classes'][number]['class_type'],
      rela_source: c.relaSource,
    })),
    routes: [...new Set([...(label?.routes ?? []), ...(ndc?.routes ?? [])])],
    strengths: ndc?.strengths ?? [],
    provenance: idProv,
  }

  // ── Cost (NADAC per candidate NDC) ──
  const candidateNdcs = (ndc?.packages ?? []).map((p) => p.ndc11).slice(0, 10)
  const descByNdc = new Map((ndc?.packages ?? []).map((p) => [p.ndc11, p.description]))
  const nadacRows = (await Promise.all(candidateNdcs.map((n) => fetchNadacForNdc(n)))).filter(
    (r): r is NonNullable<typeof r> => Boolean(r),
  )
  const partd = seed.brand ? await fetchPartD(seed.brand) : null

  const costProv: Provenance[] = []
  const points: Cost['points'] = nadacRows.map((r) => {
    const p = prov('nadac', r.url, { as_of: r.effective_date, record_id: r.ndc11, nowIso })
    costProv.push(p)
    const description = descByNdc.get(r.ndc11) || r.description
    const unitsPerPackage = parseUnitsPerPackage(description)
    const estPkg = estPackageCost(r.per_unit_usd, unitsPerPackage)
    const monthly = estMonthly({
      perUnit: r.per_unit_usd,
      unitsPerPackage,
      pricingUnit: r.pricing_unit,
      maintenance: seed.maintenance,
    })
    return {
      ndc11: r.ndc11,
      description,
      nadac_per_unit_usd: r.per_unit_usd,
      pricing_unit: r.pricing_unit,
      units_per_package: unitsPerPackage,
      est_package_cost_usd: estPkg,
      est_monthly_cost_usd: monthly?.value ?? null,
      est_monthly_method: monthly?.method ?? null,
      effective_date: r.effective_date,
      provenance: p,
    }
  })
  if (partd) costProv.push(prov('medicare_partd', partd.url, { nowIso }))
  const pkgCosts = points.map((p) => p.est_package_cost_usd).filter((n): n is number => n != null)

  const cost: Omit<Cost, 'cost_basis' | 'disclaimer'> = {
    points,
    package_low_usd: pkgCosts.length ? Math.min(...pkgCosts) : null,
    package_high_usd: pkgCosts.length ? Math.max(...pkgCosts) : null,
    medicare_context: partd
      ? {
          total_spending_usd: partd.total_spending_usd,
          total_claims: partd.total_claims,
          avg_spend_per_claim_usd: partd.avg_spend_per_claim_usd,
          year: partd.year,
          provenance: prov('medicare_partd', partd.url, { nowIso }),
        }
      : null,
    coverage_note: points.length ? null : 'No NADAC rows matched this product’s NDC set.',
    provenance: costProv.length ? costProv : [prov('nadac', 'https://data.medicaid.gov/dataset/nadac', { nowIso })],
  }

  // ── Shortage ──
  const shortageObj: Omit<Shortage, 'disclaimer'> = shortage
    ? {
        status: mapShortageStatus(shortage.status),
        reason: shortage.reason,
        resupply_estimate: shortage.availability,
        presentations_affected: shortage.presentations,
        initial_posting_date: mdyToIso(shortage.initial_posting_date),
        update_date: mdyToIso(shortage.update_date),
        provenance: prov('openfda_shortages', shortage.url, { as_of: mdyToIso(shortage.update_date), nowIso }),
      }
    : {
        status: 'available',
        reason: null,
        resupply_estimate: null,
        presentations_affected: [],
        initial_posting_date: null,
        update_date: null,
        provenance: prov(
          'openfda_shortages',
          `https://api.fda.gov/drug/shortages.json?search=openfda.generic_name:%22${encodeURIComponent(seed.ingredient)}%22`,
          { nowIso },
        ),
      }

  // ── Label (verbatim quotes + FAERS) ──
  const quotes: Label['quotes'] = []
  const pushQuote = (section: Label['quotes'][number]['section'], raw: string | undefined, highlight = false) => {
    if (!raw) return
    const { text, truncated } = truncate(raw)
    quotes.push({ section, text, highlight: highlight ? missedDoseSentence(raw) : null, truncated })
  }
  if (label) {
    pushQuote('boxed_warning', label.sections.boxed_warning)
    pushQuote('dosage_and_administration', label.sections.dosage_and_administration, true)
    pushQuote('indications_and_usage', label.sections.indications_and_usage)
    pushQuote('adverse_reactions', label.sections.adverse_reactions)
  }
  const labelProv: Provenance[] = []
  if (label) {
    labelProv.push(prov('openfda_label', label.url, { as_of: yyyymmddToIso(label.effective_time), record_id: label.setid, nowIso }))
    if (label.setid) labelProv.push(prov('dailymed', dailymedUrl(label.setid), { record_id: label.setid, nowIso }))
  }
  if (faers) labelProv.push(prov('openfda_faers', faers.url, { record_id: faers.query, nowIso }))

  const labelObj: Omit<Label, 'faers_disclaimer' | 'label_disclaimer'> = {
    setid: label?.setid ?? '',
    spl_version: null,
    effective_time: yyyymmddToIso(label?.effective_time),
    dailymed_url: label?.setid ? dailymedUrl(label.setid) : 'https://dailymed.nlm.nih.gov/dailymed/',
    quotes,
    faers_total_reports: faers?.total ?? null,
    faers_top_reactions: faers?.top ?? [],
    faers_query: faers?.query ?? '',
    provenance: labelProv.length ? labelProv : [prov('openfda_label', 'https://api.fda.gov/drug/label.json', { nowIso })],
  }

  // ── Alternatives (same ATC class, clinician-gated) ──
  // Drive off the seed's intended ATC (4th level), NOT the first ATC RxClass returns —
  // for atorvastatin/dapagliflozin that first entry is a COMBINATION class with no peers.
  const atcClassId = seed.atc.code.slice(0, 5) // e.g. 'C10AA05' → 'C10AA'
  const atcName = classes.classes.find((c) => c.classId === atcClassId)?.className ?? seed.atc.name
  const altRes = await fetchClassMembers(atcClassId, 'ATC')
  const altUrl = altRes.url
  const altMembers: Alternatives['same_class'] = altRes.members
    .filter((m) => m.name.toLowerCase() !== seed.ingredient.toLowerCase())
    .slice(0, 12)
    .map((m) => {
      const inReg = DRUGS.find((d) => d.ingredient.toLowerCase() === m.name.toLowerCase())
      return {
        drug_id: inReg?.slug ?? null,
        brand_name: '',
        generic_name: m.name,
        rxcui: m.rxcui,
        shared_class: atcName,
        shared_class_type: 'ATC1-4',
        in_registry: Boolean(inReg),
        provenance: prov('rxclass', altUrl, { record_id: atcClassId, nowIso }),
      }
    })

  const alternatives: Omit<Alternatives, 'basis' | 'clinician_gate'> = {
    same_class: altMembers,
    provenance: [prov('rxclass', altUrl || 'https://rxnav.nlm.nih.gov/REST/rxclass/', { nowIso })],
  }

  // ── Compose, validate (parse throws on bad data), and return the literal-free input ──
  const sources = [
    ...identity.provenance,
    ...cost.provenance,
    shortageObj.provenance,
    ...labelObj.provenance,
    ...alternatives.provenance,
  ]

  const input: DrugInput = {
    drug_id: seed.slug,
    identity,
    cost,
    shortage: shortageObj,
    label: labelObj,
    alternatives,
    meta: { generated_at: nowIso, freshness: 'cached', sources },
  }

  Drug.parse(input) // build-time validation; throws if any source produced a bad shape
  return input
}
