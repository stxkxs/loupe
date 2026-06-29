// RxNav fetchers: RxClass pharmacologic classes for a drug, and same-class members.

import { getJsonOrNull } from '../http'

const RX = 'https://rxnav.nlm.nih.gov/REST'

// class types we surface (DrugClass enum); drop DISEASE/DISPOS/STRUCT noise
const KEEP = new Set(['ATC1-4', 'MOA', 'EPC', 'PE', 'CHEM'])

export interface RxClassInfo {
  classId: string
  className: string
  classType: string
  relaSource: string | null
}

export async function fetchClasses(rxcui: string): Promise<{ url: string; classes: RxClassInfo[] }> {
  const url = `${RX}/rxclass/class/byRxcui.json?rxcui=${rxcui}`
  const data = await getJsonOrNull<{
    rxclassDrugInfoList?: {
      rxclassDrugInfo?: {
        rxclassMinConceptItem: { classId: string; className: string; classType: string }
        relaSource?: string
      }[]
    }
  }>(url)
  const list = data?.rxclassDrugInfoList?.rxclassDrugInfo ?? []
  const seen = new Set<string>()
  const classes: RxClassInfo[] = []
  for (const d of list) {
    const c = d.rxclassMinConceptItem
    if (!KEEP.has(c.classType)) continue
    const key = `${c.classType}:${c.classId}`
    if (seen.has(key)) continue
    seen.add(key)
    classes.push({
      classId: c.classId,
      className: c.className,
      classType: c.classType,
      relaSource: d.relaSource ?? null,
    })
  }
  return { url, classes }
}

export interface ClassMember {
  rxcui: string
  name: string
  tty: string
}

export async function fetchClassMembers(
  classId: string,
  relaSource: string,
): Promise<{ url: string; members: ClassMember[] }> {
  const url = `${RX}/rxclass/classMembers.json?classId=${classId}&relaSource=${relaSource}&ttys=IN`
  const data = await getJsonOrNull<{
    drugMemberGroup?: { drugMember?: { minConcept: { rxcui: string; name: string; tty: string } }[] }
  }>(url)
  const list = data?.drugMemberGroup?.drugMember ?? []
  return {
    url,
    members: list.map((m) => ({
      rxcui: m.minConcept.rxcui,
      name: m.minConcept.name,
      tty: m.minConcept.tty,
    })),
  }
}
