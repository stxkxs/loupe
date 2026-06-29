// Cost derivations (SPEC §3.6). Every value here is either FACTUAL (package cost =
// per-unit × units-per-package, both from the data) or a clearly-labeled est. that
// requires NO clinical/dose assumption. The monthly estimate is computed ONLY when the
// package is dose-countable (one unit ≈ one administration, e.g. tablets/pens priced
// per EA); for mL-priced injectables it stays null (mapping mg→mL needs concentration,
// which is dose-adjacent reasoning the guardrails forbid). Package cost is shown instead.

const round2 = (n: number) => Math.round(n * 100) / 100

/** Parse the leading quantity from an openFDA package description, e.g. "3 mL in 1 PEN" → 3. */
export function parseUnitsPerPackage(description: string): number | null {
  const m = description.match(/^\s*([\d.]+)\s*[a-zA-Z]/)
  if (!m) return null
  const qty = Number(m[1])
  return Number.isFinite(qty) && qty > 0 ? qty : null
}

/** FACTUAL: what a pharmacy pays to acquire one package. */
export function estPackageCost(perUnit: number | null, unitsPerPackage: number | null): number | null {
  if (perUnit == null || unitsPerPackage == null) return null
  return round2(perUnit * unitsPerPackage)
}

export interface MonthlyEstimate {
  value: number
  method: string
}

export function estMonthly(opts: {
  perUnit: number | null
  unitsPerPackage: number | null
  pricingUnit: string | null
  maintenance: { dose: string; per_days: number } | null
}): MonthlyEstimate | null {
  const { perUnit, unitsPerPackage, pricingUnit, maintenance } = opts
  if (perUnit == null || unitsPerPackage == null || !maintenance) return null
  // dose-countable only: each unit ≈ one administration
  if (!pricingUnit || !/^(EA|TAB)/i.test(pricingUnit)) return null
  const dosesPer28 = Math.round(28 / maintenance.per_days)
  const packagesPer28 = dosesPer28 / unitsPerPackage
  const value = round2(perUnit * unitsPerPackage * packagesPer28)
  return {
    value,
    method: `est. = $${perUnit}/unit × ${unitsPerPackage} units/pkg × ${packagesPer28.toFixed(2)} pkg per 28 days (SPL maintenance ${maintenance.dose}/${maintenance.per_days}d; 1 unit ≈ 1 dose). NADAC acquisition cost, not copay.`,
  }
}
