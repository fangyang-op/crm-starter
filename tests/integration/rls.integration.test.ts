import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type Fixtures,
  hasSupabaseCreds,
  seedFixtures,
  signInAs,
  teardownFixtures,
} from './helpers/supabase'

// Skips cleanly when no Supabase creds (CI unit-only job, or local without
// .env.test). Jo / CI run this with credentials present.
const suite = hasSupabaseCreds ? describe : describe.skip

if (!hasSupabaseCreds) {
  // eslint-disable-next-line no-console
  console.warn(
    '[rls.integration] SKIPPED — no Supabase test credentials. Set TEST_SUPABASE_URL / ' +
      'TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_* + SERVICE_ROLE) to run.',
  )
}

suite('Stage 3 — cross-role RLS isolation (附錄 C.4)', () => {
  let fx: Fixtures

  beforeAll(async () => {
    fx = await seedFixtures()
  }, 60_000)

  afterAll(async () => {
    await teardownFixtures()
  }, 60_000)

  /** ids of the 4 test students visible to a given RLS-scoped client. */
  async function visibleIds(c: SupabaseClient): Promise<Set<string>> {
    const all = Object.values(fx.studentIds)
    const { data, error } = await c
      .from('students')
      .select('id')
      .in('id', all)
      .is('deleted_at', null)
    if (error) throw error
    return new Set((data as { id: string }[]).map((r) => r.id))
  }

  it("C.4 #1 — a frontend consultant sees ONLY their own students (not another owner's)", async () => {
    const c = await signInAs('fe_consultant')
    const vis = await visibleIds(c)
    expect(vis.has(fx.studentIds.feA)).toBe(true)
    expect(vis.has(fx.studentIds.beA)).toBe(true)
    expect(vis.has(fx.studentIds.shared)).toBe(true)
    expect(vis.has(fx.studentIds.feB)).toBe(false) // owned by fe_manager
    expect(vis.size).toBe(3)
  })

  it("C.4 #2 — a consultant cannot read another owner's student by direct id (RLS → empty)", async () => {
    const c = await signInAs('fe_consultant')
    const { data, error } = await c.from('students').select('id').eq('id', fx.studentIds.feB)
    expect(error).toBeNull()
    expect(data).toEqual([])
    // sanity: their own student IS reachable by id
    const own = await c.from('students').select('id').eq('id', fx.studentIds.feA)
    expect(own.data).toHaveLength(1)
  })

  it('C.4 #3 — a backend consultant sees ONLY students assigned to them as backend', async () => {
    const c = await signInAs('be_consultant')
    const vis = await visibleIds(c)
    expect(vis.has(fx.studentIds.beA)).toBe(true)
    expect(vis.has(fx.studentIds.shared)).toBe(true)
    expect(vis.has(fx.studentIds.feA)).toBe(false)
    expect(vis.has(fx.studentIds.feB)).toBe(false)
    expect(vis.size).toBe(2)
  })

  it.each(['fe_manager', 'be_manager', 'admin'] as const)(
    'C.4 #7 — %s sees ALL students',
    async (role) => {
      const c = await signInAs(role)
      const vis = await visibleIds(c)
      expect(vis.size).toBe(4)
    },
  )

  it('settings table (lead_sources) INSERT is rejected for a non-admin (RLS WITH CHECK)', async () => {
    const c = await signInAs('fe_consultant')
    const { data, error } = await c
      .from('lead_sources')
      .insert({ code: 't3test_should_fail', label_zh: 't3', sort_order: 999 })
      .select('id')
    expect(error).toBeTruthy() // blocked by RLS
    expect(data).toBeNull()
  })

  it('C.4 #8 — phone-reverse RPC: consultant gets NO PII; manager gets full matches', async () => {
    const consultant = await signInAs('fe_consultant')
    const cRes = (
      await consultant.rpc('find_duplicate_student_by_phone', { p_phone: fx.studentPhones.feA })
    ).data as { is_duplicate: boolean; matches: unknown[]; message?: string }
    expect(cRes.is_duplicate).toBe(true)
    expect(cRes.matches).toEqual([]) // minimal disclosure — no name / advisor / id
    expect(cRes.message).toBeTruthy()

    const manager = await signInAs('fe_manager')
    const mRes = (
      await manager.rpc('find_duplicate_student_by_phone', { p_phone: fx.studentPhones.feA })
    ).data as { is_duplicate: boolean; matches: { full_name?: string }[] }
    expect(mRes.is_duplicate).toBe(true)
    expect(mRes.matches.length).toBe(1)
    expect(mRes.matches[0].full_name).toBeTruthy()
  })

  it('C.4 #8c — find_phone_anywhere: consultant gets NO PII', async () => {
    const c = await signInAs('fe_consultant')
    const res = (await c.rpc('find_phone_anywhere', { p_phone: fx.studentPhones.feA })).data as {
      is_duplicate: boolean
      matches: unknown[]
      message?: string
    }
    expect(res.is_duplicate).toBe(true)
    expect(res.matches).toEqual([])
    expect(res.message).toBeTruthy()
  })

  // ── Coverage notes for the remaining C.4 rows ──────────────────────────────
  // #4 #5 #6  route protection (consultant/manager blocked from /settings,
  //           /uat/admin; manager allowed on /duplicate-overrides) → covered by
  //           the Playwright E2E suite (tests/e2e/route-protection.spec.ts),
  //           which exercises the Next middleware + page gates with real cookies.
  // #9        storage signed-URL access → buckets are Private + only
  //           createSignedUrl(60) is used (verified Stage 0); an authenticated
  //           download E2E is added in Phase 2.
  // #10       createStudent server-side override gate (consultant cannot
  //           self-override, fail-closed) → the DB signal it relies on is
  //           verified above (#8: consultant still gets is_duplicate=true); the
  //           server-action enforcement is covered by the dup-detection E2E
  //           (Phase 2) + the Stage 2-A adversarial review.
})
