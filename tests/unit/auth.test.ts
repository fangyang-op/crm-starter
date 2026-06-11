import { describe, expect, it } from 'vitest'

import {
  adminResetPasswordSchema,
  generateRandomPassword,
  resetPasswordSchema,
} from '@/lib/validators/auth'

// passwordRule is internal; we exercise it through the exported schemas.
describe('passwordRule (via resetPasswordSchema)', () => {
  it('accepts a valid password (≥8, upper + lower + digit)', () => {
    const pw = 'Abcd1234'
    expect(resetPasswordSchema.safeParse({ new_password: pw, confirm_password: pw }).success).toBe(
      true,
    )
  })

  it.each([
    ['too short (<8)', 'Abc123'],
    ['no uppercase', 'abcd1234'],
    ['no lowercase', 'ABCD1234'],
    ['no digit', 'Abcdefgh'],
  ])('rejects: %s', (_label, pw) => {
    expect(resetPasswordSchema.safeParse({ new_password: pw, confirm_password: pw }).success).toBe(
      false,
    )
  })

  it('accepts exactly 8 chars (lower boundary)', () => {
    expect(
      resetPasswordSchema.safeParse({ new_password: 'Abcd123x', confirm_password: 'Abcd123x' })
        .success,
    ).toBe(true)
  })

  it('rejects 129 chars (upper boundary 128)', () => {
    const long = 'Aa1' + 'x'.repeat(126)
    expect(long).toHaveLength(129)
    expect(
      resetPasswordSchema.safeParse({ new_password: long, confirm_password: long }).success,
    ).toBe(false)
  })

  it('rejects when the two passwords do not match', () => {
    const r = resetPasswordSchema.safeParse({
      new_password: 'Abcd1234',
      confirm_password: 'Abcd1235',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.confirm_password?.[0]).toContain('兩次')
  })
})

describe('adminResetPasswordSchema', () => {
  it('requires a uuid user_id', () => {
    expect(
      adminResetPasswordSchema.safeParse({ user_id: 'not-a-uuid', new_password: 'Abcd1234' })
        .success,
    ).toBe(false)
  })
  it('accepts a uuid + valid password', () => {
    expect(
      adminResetPasswordSchema.safeParse({
        user_id: '00000000-0000-0000-0000-000000000000',
        new_password: 'Abcd1234',
      }).success,
    ).toBe(true)
  })
})

describe('generateRandomPassword (CSPRNG, rejection sampling)', () => {
  const ALLOWED = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/

  it('defaults to length 16', () => {
    expect(generateRandomPassword()).toHaveLength(16)
  })

  it('respects a custom length', () => {
    expect(generateRandomPassword(24)).toHaveLength(24)
  })

  it('only uses the confusable-free, symbol-free charset', () => {
    for (let i = 0; i < 500; i++) expect(generateRandomPassword()).toMatch(ALLOWED)
  })

  it('always satisfies passwordRule so server-side zod never rejects a generated password', () => {
    for (let i = 0; i < 1000; i++) {
      const p = generateRandomPassword()
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/\d/)
      expect(resetPasswordSchema.safeParse({ new_password: p, confirm_password: p }).success).toBe(
        true,
      )
    }
  })

  it('excludes visually-confusable characters (0 O 1 l I i o)', () => {
    const joined = Array.from({ length: 200 }, () => generateRandomPassword()).join('')
    for (const ch of ['0', 'O', '1', 'l', 'I', 'i', 'o']) expect(joined).not.toContain(ch)
  })

  it('has no collisions across 5000 draws (adequate entropy)', () => {
    const set = new Set<string>()
    for (let i = 0; i < 5000; i++) set.add(generateRandomPassword())
    expect(set.size).toBe(5000)
  })

  it('is approximately unbiased per character (no pathological modulo bias)', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 4000; i++)
      for (const ch of generateRandomPassword()) counts[ch] = (counts[ch] || 0) + 1
    const values = Object.values(counts)
    // Every charset symbol should appear; spread stays modest (the guaranteed
    // upper/lower/digit slots make digits slightly more frequent, ~1.3x).
    expect(values.length).toBeGreaterThanOrEqual(50)
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(3)
  })
})
