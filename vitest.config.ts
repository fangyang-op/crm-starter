import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // Tests resolve `@/…` like the app does.
      '@': root,
      // `server-only` throws when imported outside a React Server Component.
      // Stub it so server-side utils (e.g. lib/utils/file-validation.ts,
      // lib/crypto.ts) can be unit-tested in a plain Node/Vitest context.
      'server-only': path.resolve(root, 'tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    // Unit tests are pure + DB-free. Integration tests (Supabase) live under
    // tests/integration and self-skip when no credentials are present.
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // Scope to the unit-testable pure-logic / security-primitive layer. Server
      // actions, RLS and routes are exercised by the integration + E2E suites
      // (behaviour-verified), not by these unit tests, so including them here
      // would understate unit coverage. Phase 3 extends unit coverage outward.
      include: ['lib/utils.ts', 'lib/utils/**/*.ts', 'lib/validators/auth.ts', 'lib/crypto.ts'],
      exclude: ['**/*.d.ts', 'types/**', 'tests/**', '**/*.config.*'],
    },
  },
})
