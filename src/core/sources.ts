import type { SourceId } from './provenance'

/**
 * The source manifest — single source of truth for human labels, base endpoints,
 * and access terms. Drives ProvenanceFootnote labels, navigator.json, and llms.txt.
 * Every source is free, keyless at the edge, and contains ZERO patient data
 * (drug-PRODUCT reference data only).
 */
export interface SourceMeta {
  id: SourceId
  label: string
  base: string
  no_key: boolean
  rate_limit: string
}

export const SOURCES: Record<SourceId, SourceMeta> = {
  openfda_label: {
    id: 'openfda_label',
    label: 'openFDA Drug Label (SPL)',
    base: 'https://api.fda.gov/drug/label.json',
    no_key: true,
    rate_limit: '240/min, 1000/day keyless (server uses a free key: 120k/day)',
  },
  openfda_shortages: {
    id: 'openfda_shortages',
    label: 'openFDA Drug Shortages',
    base: 'https://api.fda.gov/drug/shortages.json',
    no_key: true,
    rate_limit: '240/min, 1000/day keyless',
  },
  openfda_faers: {
    id: 'openfda_faers',
    label: 'openFDA Adverse Events (FAERS)',
    base: 'https://api.fda.gov/drug/event.json',
    no_key: true,
    rate_limit: '240/min, 1000/day keyless',
  },
  openfda_ndc: {
    id: 'openfda_ndc',
    label: 'openFDA NDC Directory',
    base: 'https://api.fda.gov/drug/ndc.json',
    no_key: true,
    rate_limit: '240/min, 1000/day keyless',
  },
  rxnorm: {
    id: 'rxnorm',
    label: 'NLM RxNorm (RxNav)',
    base: 'https://rxnav.nlm.nih.gov/REST',
    no_key: true,
    rate_limit: '~20/sec, no key',
  },
  rxclass: {
    id: 'rxclass',
    label: 'NLM RxClass',
    base: 'https://rxnav.nlm.nih.gov/REST/rxclass',
    no_key: true,
    rate_limit: '~20/sec, no key',
  },
  nadac: {
    id: 'nadac',
    label: 'CMS NADAC (acquisition cost)',
    base: 'https://data.medicaid.gov/api/1/datastore/query',
    no_key: true,
    rate_limit: 'no key',
  },
  medicare_partd: {
    id: 'medicare_partd',
    label: 'CMS Medicare Part D Spending by Drug',
    base: 'https://data.cms.gov/data-api/v1/dataset',
    no_key: true,
    rate_limit: 'no key',
  },
  dailymed: {
    id: 'dailymed',
    label: 'NLM DailyMed (SPL)',
    base: 'https://dailymed.nlm.nih.gov/dailymed/services/v2',
    no_key: true,
    rate_limit: 'no key',
  },
}
