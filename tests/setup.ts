import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'

import { config } from 'dotenv'

// Load env for integration tests. Prefer `.env.test` (gitignored, holds the
// dedicated test-DB credentials per the Stage 3 spec); fall back to `.env.local`
// for local runs. In CI, secrets are injected as real env vars so neither file
// exists and these calls are no-ops. dotenv does NOT override already-set vars.
for (const file of ['.env.test', '.env.local']) {
  if (existsSync(file)) config({ path: file })
}

// lib/crypto.ts reads ENCRYPTION_KEY at import-time. Provide a throwaway 32-byte
// hex key for unit tests if none is set (e.g. the CI unit job). Random per run —
// it only ever encrypts test data and is never a committed secret.
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex')
}
