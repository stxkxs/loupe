// Upstream date formats → ISO yyyy-mm-dd (the on-the-wire `as_of` / date shape).

export function mdyToIso(s: string | null | undefined): string | null {
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
}

export function yyyymmddToIso(s: string | null | undefined): string | null {
  if (!s) return null
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

export function mdyToEpoch(s: string | null | undefined): number {
  const iso = mdyToIso(s)
  return iso ? Date.parse(iso) : 0
}
