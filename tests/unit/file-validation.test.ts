import { describe, expect, it } from 'vitest'

import { sniffUploadedFile } from '@/lib/utils/file-validation'

// Minimal real magic-byte payloads.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TEXT = Buffer.from('just plain text pretending to be a pdf by filename only')
const MB = 1024 * 1024

function asFile(buf: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(buf)], name, { type })
}

describe('sniffUploadedFile — magic-byte content sniffing', () => {
  it('accepts a real PDF for a pdf-only whitelist', async () => {
    const r = await sniffUploadedFile(asFile(PDF, 'doc.pdf', 'application/pdf'), {
      allowed: ['pdf'],
      maxBytes: 10 * MB,
    })
    expect(r).toEqual({ ok: true, mime: 'application/pdf', ext: 'pdf' })
  })

  it('accepts a real PNG for an image whitelist', async () => {
    const r = await sniffUploadedFile(asFile(PNG, 'shot.png', 'image/png'), {
      allowed: ['png', 'jpeg', 'webp'],
      maxBytes: 5 * MB,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.mime).toBe('image/png')
  })

  it('rejects a PNG when only PDF is allowed (cross-type)', async () => {
    const r = await sniffUploadedFile(asFile(PNG, 'shot.png', 'image/png'), {
      allowed: ['pdf'],
      maxBytes: 10 * MB,
    })
    expect(r.ok).toBe(false)
  })

  it('rejects a spoofed file (text renamed .pdf, MIME forged application/pdf)', async () => {
    const r = await sniffUploadedFile(asFile(TEXT, 'evil.pdf', 'application/pdf'), {
      allowed: ['pdf'],
      maxBytes: 10 * MB,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('檔案格式')
  })

  it('rejects an oversize file (size check before content)', async () => {
    const r = await sniffUploadedFile(asFile(Buffer.alloc(2 * MB), 'big.pdf', 'application/pdf'), {
      allowed: ['pdf'],
      maxBytes: 1 * MB,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('過大')
  })

  it('rejects empty and non-File inputs', async () => {
    const empty = await sniffUploadedFile(asFile(Buffer.alloc(0), 'empty.pdf', 'application/pdf'), {
      allowed: ['pdf'],
      maxBytes: 10 * MB,
    })
    expect(empty.ok).toBe(false)
    const notFile = await sniffUploadedFile(null, { allowed: ['pdf'], maxBytes: 10 * MB })
    expect(notFile.ok).toBe(false)
  })

  it('returns the DETECTED mime (authoritative), ignoring the client-declared type', async () => {
    // declared image/png but bytes are really a PDF → detected pdf wins
    const r = await sniffUploadedFile(asFile(PDF, 'x.png', 'image/png'), {
      allowed: ['pdf'],
      maxBytes: 10 * MB,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.mime).toBe('application/pdf')
  })
})
