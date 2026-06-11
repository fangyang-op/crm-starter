import { describe, expect, it } from 'vitest'

import { isValidTaiwanPhone, normalizePhone } from '@/lib/utils/phone'

describe('normalizePhone', () => {
  it.each([
    ['+886912345678', '0912345678'],
    ['0912-345-678', '0912345678'],
    ['0912 345 678', '0912345678'],
    ['(02) 5580-2586', '0255802586'],
    ['+886255802586', '0255802586'],
    ['+886-2-5580-2586', '0255802586'],
    ['  0912345678  ', '0912345678'],
  ])('normalizes %s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected)
  })

  it('converts +8869 (mobile) to 09 before the generic +886 → 0 rule', () => {
    expect(normalizePhone('+886912345678')).toBe('0912345678')
  })

  it('returns empty string for null / undefined / blank', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
    expect(normalizePhone('   ')).toBe('')
  })
})

describe('isValidTaiwanPhone (expects a normalized number)', () => {
  it.each(['0912345678', '0255802586', '025580258'])('accepts valid: %s', (p) => {
    expect(isValidTaiwanPhone(p)).toBe(true)
  })

  it.each(['0912345', '12345678', '0112345678', '0912-345-678', ''])('rejects invalid: %s', (p) => {
    expect(isValidTaiwanPhone(p)).toBe(false)
  })

  // Documents existing (slightly loose) behaviour rather than asserting a fix:
  // the landline pattern 0[2-9]\d{7,8} treats a 9-digit "09…" string as a valid
  // landline (9 ∈ [2-9]). Flagged as a low-severity observation in the report.
  it('accepts a 9-digit 09-prefixed number as a landline (pre-existing looseness)', () => {
    expect(isValidTaiwanPhone('091234567')).toBe(true)
  })
})
