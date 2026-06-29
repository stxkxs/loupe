// NDC normalization (SPEC §3.4). NADAC keys on 11-digit NDCs (no hyphens); openFDA
// returns hyphenated 4-4-2 / 5-3-2 / 5-4-1 package NDCs and 10-digit product NDCs.
// The 11-digit canonical form is 5-4-2; the short segment in each pattern gets the
// leading zero — which a per-segment left-pad to (5,4,2) handles for all three.

export function to11(ndc: string): string | null {
  if (!ndc) return null
  const parts = ndc.split('-')
  if (parts.length === 3) {
    const [a, b, c] = parts
    const padded = a.padStart(5, '0') + b.padStart(4, '0') + c.padStart(2, '0')
    return padded.length === 11 && /^\d{11}$/.test(padded) ? padded : null
  }
  const digits = ndc.replace(/\D/g, '')
  if (digits.length === 11) return digits
  // bare 10-digit (no segmentation hint) — assume the common 4-4-2 → pad to 5-4-2
  if (digits.length === 10) return ('0' + digits).slice(0, 11)
  return null
}

/** The product NDC (first two segments) for grouping packages under a product. */
export function productOf(ndc11: string): string {
  return ndc11.slice(0, 9)
}
