import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Relative imports so resolution matches the helpers (server-only is stubbed in
// vitest.config, so lib/crypto imports cleanly here).
import { decrypt, encrypt } from '../../lib/crypto'
import { seedPhase2, teardownPhase2, type Phase2Fixtures } from './helpers/phase2-fixtures'
import {
  type Fixtures,
  hasSupabaseCreds,
  seedFixtures,
  service,
  signInAs,
  teardownFixtures,
} from './helpers/supabase'

const suite = hasSupabaseCreds ? describe : describe.skip

if (!hasSupabaseCreds) {
  // eslint-disable-next-line no-console
  console.warn(
    '[phase2-flows] SKIPPED — no Supabase test credentials. Set TEST_SUPABASE_URL / ' +
      'TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY to run.',
  )
}

const REQUIRED_DOCS_BUCKET = 'student-required-documents'

/** Supabase storage signed URLs embed a JWT in ?token=; assert exp-iat == ttl. */
function signedUrlTtlSeconds(signedUrl: string): number {
  const token = new URL(signedUrl).searchParams.get('token')
  if (!token) throw new Error('signed URL has no token param')
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  return payload.exp - payload.iat
}

suite('Stage 3 Phase 2 — core-flow security cores (integration; anon key + role session)', () => {
  let fx: Fixtures
  let p2: Phase2Fixtures
  let planId: string
  let seededUatRowId: string | null = null

  beforeAll(async () => {
    fx = await seedFixtures()
    p2 = await seedPhase2(fx)
    const { data: plan, error } = await service()
      .from('service_plans')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    if (error) throw new Error('resolve active service_plan: ' + error.message)
    planId = (plan as { id: string }).id
  }, 90_000)

  afterAll(async () => {
    if (seededUatRowId) await service().from('uat_results').delete().eq('id', seededUatRowId)
    await teardownPhase2(fx)
    await teardownFixtures()
  }, 90_000)

  // ── Flow D — 成交 → 解鎖. The tab-unlock gate is only flippable by creating a
  //    deal, and create_deal fail-closes for a non-owning consultant. ───────────
  describe('Flow D — create_deal authorization (附錄 C.4 deal gate)', () => {
    const splitTo = (uid: string) => [
      {
        role_in_deal: 'primary_consultant',
        recipient_user_id: uid,
        recipient_referrer_id: null,
        percentage: 100,
        notes: null,
      },
    ]
    const dealArgs = (studentId: string, recipientUid: string) => ({
      p_student_id: studentId,
      p_plan_id: planId,
      p_extra_school_count: 0,
      p_extra_word_quota: 0,
      p_discount_amount: 0,
      p_discount_reason: null,
      p_signed_at: '2026-06-12',
      p_contract_no: null,
      p_payment_status: 'pending',
      p_notes: null,
      p_splits: splitTo(recipientUid),
    })

    it('non-owner consultant is BLOCKED (RPC raises 42501) and writes no deal', async () => {
      // be_consultant is NOT assigned to feA (feA.be = null) → must be denied.
      const c = await signInAs('be_consultant')
      const { data, error } = await c.rpc(
        'create_deal',
        dealArgs(fx.studentIds.feA, fx.userIds.be_consultant),
      )
      expect(error).toBeTruthy()
      expect(error?.message ?? '').toContain('無權限')
      expect(data).toBeNull()
      const { count } = await service()
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', fx.studentIds.feA)
      expect(count).toBe(0)
    })

    it('owning consultant is ALLOWED (deal created)', async () => {
      const c = await signInAs('fe_consultant') // owns feA (frontend)
      const { data, error } = await c.rpc(
        'create_deal',
        dealArgs(fx.studentIds.feA, fx.userIds.fe_consultant),
      )
      expect(error).toBeNull()
      expect(data).toBeTruthy() // returns the new deal uuid
    })

    it('manager is ALLOWED on any student', async () => {
      const c = await signInAs('be_manager')
      const { data, error } = await c.rpc(
        'create_deal',
        dealArgs(fx.studentIds.feB, fx.userIds.fe_manager),
      )
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })
  })

  // ── Flow F — 文件下載 via short-lived signed URL on a PRIVATE bucket
  //    (附錄 C.4 #9: design → E2E/integration verified). ─────────────────────────
  describe('Flow F — signed URL is short-lived (60s) + storage-RLS gated', () => {
    it('owning consultant gets a working 60s signed URL', async () => {
      const c = await signInAs('fe_consultant') // owns feA
      const { data, error } = await c.storage
        .from(REQUIRED_DOCS_BUCKET)
        .createSignedUrl(p2.objFeA, 60)
      expect(error).toBeNull()
      expect(data?.signedUrl).toContain('token=')
      expect(signedUrlTtlSeconds(data!.signedUrl)).toBe(60) // genuinely short-lived
      const res = await fetch(data!.signedUrl)
      expect(res.status).toBe(200) // the URL actually resolves to the object
    })

    it('non-owner consultant is DENIED a usable URL', async () => {
      const c = await signInAs('fe_consultant') // does NOT own feB
      const { data, error } = await c.storage
        .from(REQUIRED_DOCS_BUCKET)
        .createSignedUrl(p2.objFeB, 60)
      expect(Boolean(error) || !data?.signedUrl).toBe(true) // RLS denies the SELECT
    })

    it('manager gets a URL for any student', async () => {
      const c = await signInAs('fe_manager')
      const { data, error } = await c.storage
        .from(REQUIRED_DOCS_BUCKET)
        .createSignedUrl(p2.objFeB, 60)
      expect(error).toBeNull()
      expect(data?.signedUrl).toContain('token=')
    })
  })

  // ── Flow G — 帳密頁. Portal password is AES-256-GCM at rest; read/write is
  //    RLS-gated to managers/admin + the owning consultant. ─────────────────────
  describe('Flow G — application portal credential (AES round-trip + RLS)', () => {
    const PW = 'P0rtal!學生Secret'

    it('owning consultant sets password → ciphertext at rest, decrypts back to plaintext', async () => {
      const c = await signInAs('be_consultant') // backend consultant of `shared`
      const { error } = await c.rpc('update_application_portal', {
        p_id: p2.appSharedId,
        p_portal_url: null,
        p_portal_username: null,
        p_portal_password_encrypted: encrypt(PW),
        p_set_password: true,
        p_portal_notes: null,
      })
      expect(error).toBeNull()
      const { data } = await service()
        .from('applications')
        .select('portal_password_encrypted')
        .eq('id', p2.appSharedId)
        .single()
      const blob = (data as { portal_password_encrypted: string }).portal_password_encrypted
      expect(blob).not.toBe(PW) // never plaintext at rest (禁忌 #3)
      expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/) // base64 GCM blob
      expect(decrypt(blob)).toBe(PW) // round-trip
    })

    it('non-owner consultant: READ is RLS-filtered (data null) and WRITE fails closed (42501)', async () => {
      const c = await signInAs('fe_consultant') // NOT a consultant of feB
      const read = await c
        .from('applications')
        .select('portal_password_encrypted')
        .eq('id', p2.appFeBId)
        .maybeSingle()
      expect(read.error).toBeNull()
      expect(read.data).toBeNull() // RLS filters the row — a deny is empty, not an error

      const write = await c.rpc('update_application_portal', {
        p_id: p2.appFeBId,
        p_portal_url: null,
        p_portal_username: null,
        p_portal_password_encrypted: encrypt('should-not-stick'),
        p_set_password: true,
        p_portal_notes: null,
      })
      expect(write.error).toBeTruthy()
      expect(write.error?.message ?? '').toContain('無權限')
    })

    it('manager can set the password on any application and it round-trips', async () => {
      const c = await signInAs('fe_manager')
      const { error } = await c.rpc('update_application_portal', {
        p_id: p2.appFeBId,
        p_portal_url: null,
        p_portal_username: null,
        p_portal_password_encrypted: encrypt('mgr-pw'),
        p_set_password: true,
        p_portal_notes: null,
      })
      expect(error).toBeNull()
      const { data } = await service()
        .from('applications')
        .select('portal_password_encrypted')
        .eq('id', p2.appFeBId)
        .single()
      expect(
        decrypt((data as { portal_password_encrypted: string }).portal_password_encrypted),
      ).toBe('mgr-pw')
    })
  })

  // ── Flow H — CSV 匯出 is admin-only; the underlying uat_results are per-user
  //    RLS-isolated with an admin-read backstop (so a consultant can never read
  //    another user's results that the admin export would include). ────────────
  describe('Flow H — uat_results RLS backstop (underpins admin-only export)', () => {
    it('a consultant cannot read an admin-owned UAT result; the admin can', async () => {
      const svc = service()
      // Pick a uat_item the seeded admin has no result for (avoid clobbering real
      // rows via the UNIQUE(item_id,user_id) constraint).
      const { data: usedRows } = await svc
        .from('uat_results')
        .select('item_id')
        .eq('user_id', fx.userIds.admin)
      const used = new Set((usedRows ?? []).map((r) => (r as { item_id: string }).item_id))
      const { data: items } = await svc.from('uat_items').select('id')
      const freeItem = (items ?? []).find((i) => !used.has((i as { id: string }).id))
      expect(freeItem).toBeTruthy()
      const itemId = (freeItem as { id: string }).id

      // Seed an admin-owned result carrying a CSV-injection note.
      const { data: row, error: insErr } = await svc
        .from('uat_results')
        .insert({
          item_id: itemId,
          user_id: fx.userIds.admin,
          result: 'fail',
          note: "=cmd|' /C calc'!A1",
        })
        .select('id')
        .single()
      expect(insErr).toBeNull()
      seededUatRowId = (row as { id: string }).id

      const consultant = await signInAs('fe_consultant')
      const cRes = await consultant.from('uat_results').select('id').eq('id', seededUatRowId)
      expect(cRes.error).toBeNull()
      expect(cRes.data).toEqual([]) // RLS: consultant sees only their own rows

      const admin = await signInAs('admin')
      const aRes = await admin.from('uat_results').select('id').eq('id', seededUatRowId)
      expect((aRes.data ?? []).length).toBe(1) // admin-read backstop sees it
    })
  })
})
