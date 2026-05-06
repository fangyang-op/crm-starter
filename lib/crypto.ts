import 'server-only'

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * AES-256-GCM encrypt / decrypt for sensitive at-rest data
 * (currently used for `applications.portal_password_encrypted`).
 *
 * Per docs/08 §5 — never call from a client component:
 *   - `import 'server-only'` at the top makes Next.js refuse the build
 *     if a "use client" file imports anything from here.
 *   - The key is read from process.env.ENCRYPTION_KEY which is intentionally
 *     not prefixed with NEXT_PUBLIC_ (so it never reaches the client bundle).
 *
 * Key rotation: if you generate a new ENCRYPTION_KEY, all previously stored
 * ciphertexts are unrecoverable. Rotate via a one-shot migration script that
 * decrypts with the old key + re-encrypts with the new one.
 */

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12 // GCM-recommended size
const TAG_BYTES = 16 // 128-bit authentication tag

function loadKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'ENCRYPTION_KEY missing. Set it in .env.local (32 bytes hex, e.g. via `openssl rand -hex 32`).',
    )
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('ENCRYPTION_KEY must be hex-encoded.')
  }
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). Use \`openssl rand -hex 32\`.`,
    )
  }
  return buf
}

const KEY = loadKey()

/**
 * Encrypt a UTF-8 plaintext string.
 *
 * Output layout: base64( IV(12) | authTag(16) | ciphertext(N) ).
 * The IV is freshly random per call, so encrypt(x) != encrypt(x).
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt: plaintext must be a string')
  }
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypt a ciphertext produced by `encrypt()`. Throws if:
 *   - the format is malformed (too short / not base64)
 *   - the auth tag doesn't verify (tampered, wrong key, or wrong algorithm)
 */
export function decrypt(encoded: string): string {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new TypeError('decrypt: ciphertext must be a non-empty string')
  }
  const buf = Buffer.from(encoded, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('decrypt: ciphertext too short')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
