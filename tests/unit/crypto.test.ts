import { describe, expect, it } from 'vitest'

import { decrypt, encrypt } from '@/lib/crypto'

// ENCRYPTION_KEY is provided by tests/setup.ts (throwaway, random per run).
describe('crypto — AES-256-GCM at-rest encryption (portal/visa/housing passwords)', () => {
  it('round-trips a plaintext (decrypt(encrypt(x)) === x)', () => {
    const secret = 'portal-pw: P@ssw0rd! 學生帳密'
    expect(decrypt(encrypt(secret))).toBe(secret)
  })

  it('produces different ciphertext on each call (fresh random IV)', () => {
    expect(encrypt('same input')).not.toBe(encrypt('same input'))
  })

  it('throws when the ciphertext has been tampered with (auth-tag mismatch)', () => {
    const enc = encrypt('do not tamper')
    const buf = Buffer.from(enc, 'base64')
    buf[buf.length - 1] ^= 0xff // flip a bit in the ciphertext
    expect(() => decrypt(buf.toString('base64'))).toThrow()
  })

  it('throws on malformed / empty input', () => {
    expect(() => decrypt('')).toThrow()
    expect(() => decrypt('too-short')).toThrow()
  })

  it('rejects a non-string plaintext', () => {
    // @ts-expect-error — deliberately wrong type
    expect(() => encrypt(123)).toThrow()
  })
})
