import { describe, it, expect } from 'vitest'
import { parseUnitsPerPackage, estPackageCost, estMonthly } from '@/core/derive'

describe('derive', () => {
  it('parses the leading quantity from a package description', () => {
    expect(parseUnitsPerPackage('3 mL in 1 PEN')).toBe(3)
    expect(parseUnitsPerPackage('30 TABLET in 1 BOTTLE')).toBe(30)
    expect(parseUnitsPerPackage('0.5 mL in 1 SYRINGE')).toBe(0.5)
    expect(parseUnitsPerPackage('nonsense')).toBeNull()
  })

  it('package cost is the factual per_unit × units_per_package', () => {
    expect(estPackageCost(10, 4)).toBe(40)
    expect(estPackageCost(270.62, 3)).toBe(811.86)
    expect(estPackageCost(null, 4)).toBeNull()
    expect(estPackageCost(10, null)).toBeNull()
  })

  it('monthly estimate ONLY for dose-countable (EA); null for mL injectables', () => {
    const oral = estMonthly({ perUnit: 30, unitsPerPackage: 30, pricingUnit: 'EA', maintenance: { dose: '14 mg', per_days: 1 } })
    expect(oral?.value).toBeGreaterThan(0)
    expect(oral?.method).toContain('NADAC acquisition cost, not copay')

    // mL-priced injectable → no monthly (would require a concentration assumption)
    expect(
      estMonthly({ perUnit: 200, unitsPerPackage: 1, pricingUnit: 'ML', maintenance: { dose: '10 mg', per_days: 7 } }),
    ).toBeNull()

    // no SPL maintenance dose → no monthly
    expect(
      estMonthly({ perUnit: 30, unitsPerPackage: 30, pricingUnit: 'EA', maintenance: null }),
    ).toBeNull()
  })
})
