import { describe, it, expect } from 'vitest'
import { to11, productOf } from '@/core/ndc'

describe('to11 — NDC normalization to 11-digit 5-4-2', () => {
  it('pads 4-4-2 (leading zero on segment 1)', () => {
    expect(to11('0169-4303-30')).toBe('00169430330')
  })
  it('pads 5-3-2 (leading zero on segment 2)', () => {
    expect(to11('12345-678-90')).toBe('12345067890')
  })
  it('pads 5-4-1 (leading zero on segment 3)', () => {
    expect(to11('12345-6789-0')).toBe('12345678900')
  })
  it('passes an 11-digit through', () => {
    expect(to11('00002245780')).toBe('00002245780')
  })
  it('pads a bare 10-digit', () => {
    expect(to11('0002245780')).toBe('00002245780')
  })
  it('rejects junk', () => {
    expect(to11('abc')).toBeNull()
    expect(to11('')).toBeNull()
  })
})

describe('productOf', () => {
  it('returns the first 9 (labeler+product)', () => {
    expect(productOf('00169430330')).toBe('001694303')
  })
})
