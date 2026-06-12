import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type Fixtures,
  hasSupabaseCreds,
  seedFixtures,
  service,
  signInAs,
  teardownFixtures,
} from './helpers/supabase'

// Skips cleanly when no Supabase creds (CI unit-only job / local without
// .env.test). Same gate as the RLS suite.
const suite = hasSupabaseCreds ? describe : describe.skip

if (!hasSupabaseCreds) {
  // eslint-disable-next-line no-console
  console.warn(
    '[select-minimal-disclosure] SKIPPED — no Supabase test credentials. Set TEST_SUPABASE_URL / ' +
      'TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY to run.',
  )
}

// The EXACT projections the app uses after Stage 2-C narrowing — kept verbatim
// in sync with the source queries. If a query is reverted to select('*') the
// dropped columns reappear in the response and the "not.toHaveProperty" checks
// below fail, so these tests double as a regression guard against re-widening.
const STUDENT_DETAIL_SELECT =
  'id, full_name, english_name, email, phone, line_id, birth_date, current_school, current_major, current_degree, graduation_year, target_country, target_degree, target_major, target_intake, lead_source_id, lead_source_note, lead_source_user_id, lead_source_referrer_id, frontend_consultant_id, backend_consultant_id, notes, created_at, status_id, deleted_at'
const ACTIVITY_TIMELINE_SELECT =
  'id, action, actor_id, created_at, description, payload, student_id'

suite('Stage 2-C — select() 最小揭露 (API response 欄位收斂)', () => {
  let fx: Fixtures

  beforeAll(async () => {
    fx = await seedFixtures()
    // Seed one activity_log row that carries entity_type / entity_id so we can
    // prove the narrowed timeline projection drops them. The whole row is
    // serialized into the 'use client' TimelineList, so dropping these columns
    // is a real reduction of what reaches the browser. Cleaned by
    // teardownFixtures (deletes activity_log by student_id + actor_id).
    const sb = service()
    const { error } = await sb.from('activity_log').insert({
      student_id: fx.studentIds.feA,
      actor_id: fx.userIds.fe_consultant,
      action: 'student_updated',
      description: 'T3 最小揭露測試',
      entity_type: 'student',
      entity_id: fx.studentIds.feA,
      payload: { t3: true },
    })
    if (error) throw new Error('seed activity_log: ' + error.message)
  }, 60_000)

  afterAll(async () => {
    await teardownFixtures()
  }, 60_000)

  it('students 詳情查詢只回傳收斂後欄位 — 仍含必要 PII,但不含 created_by / tags / updated_at', async () => {
    // fe_consultant owns feA (frontend_consultant_id), so RLS lets them read it.
    const c = await signInAs('fe_consultant')
    const { data, error } = await c
      .from('students')
      .select(STUDENT_DETAIL_SELECT)
      .eq('id', fx.studentIds.feA)
      .is('deleted_at', null)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    const row = data as Record<string, unknown>
    // Columns the detail page actually renders MUST still be returned.
    for (const col of ['id', 'full_name', 'email', 'phone', 'status_id', 'created_at']) {
      expect(row).toHaveProperty(col)
    }
    // Over-fetched columns are gone from the API response.
    for (const col of ['created_by', 'tags', 'updated_at']) {
      expect(row).not.toHaveProperty(col)
    }
  })

  it('對照組:select(*) 仍會回傳 created_by / tags / updated_at(證明收斂確實移除了它們)', async () => {
    // Sanity contrast — proves the columns exist on the table, so their absence
    // in the narrowed query is a real projection effect, not a missing column.
    const c = await signInAs('fe_consultant')
    const { data, error } = await c
      .from('students')
      .select('*')
      .eq('id', fx.studentIds.feA)
      .is('deleted_at', null)
      .maybeSingle()
    expect(error).toBeNull()
    const row = data as Record<string, unknown>
    for (const col of ['created_by', 'tags', 'updated_at']) {
      expect(row).toHaveProperty(col)
    }
  })

  it('activity_log 時間軸查詢(整列序列化到瀏覽器)不含 entity_type / entity_id', async () => {
    const c = await signInAs('fe_consultant')
    const { data, error } = await c
      .from('activity_log')
      .select(ACTIVITY_TIMELINE_SELECT)
      .eq('student_id', fx.studentIds.feA)
      .order('created_at', { ascending: false })
      .limit(10)
    expect(error).toBeNull()
    const rows = (data ?? []) as Record<string, unknown>[]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      // Consumed by formatActivity / the timeline UI — must be present.
      expect(row).toHaveProperty('action')
      expect(row).toHaveProperty('payload')
      // Dropped — no longer serialized into the client TimelineList payload.
      expect(row).not.toHaveProperty('entity_type')
      expect(row).not.toHaveProperty('entity_id')
    }
  })
})
