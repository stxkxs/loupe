// DailyMed: the human-readable SPL landing page for a setid (the ↗ provenance target
// for label quotes). No fetch needed — the URL is deterministic from the setid.

export function dailymedUrl(setid: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}`
}
