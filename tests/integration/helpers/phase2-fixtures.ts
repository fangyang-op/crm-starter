import type { SupabaseClient } from '@supabase/supabase-js'

// Relative import (not `@/…`) to match supabase.ts — resolves under both Vitest
// and Playwright.
import { type Fixtures, service } from './supabase'

// Phase-2 fixtures layer on TOP of the Phase-1 fixtures (seedFixtures: 5 users +
// 4 students). They add the FK targets the core-flow tests need — a school, two
// applications, and two storage objects — all prefix-tagged for zero-residue
// teardown. seed/teardown is called from a test's beforeAll/afterAll ALONGSIDE
// seedFixtures/teardownFixtures; teardownPhase2 MUST run BEFORE teardownFixtures
// because deals/schools have no ON DELETE CASCADE from students.

const SCHOOL_PREFIX = '【T3】'
const REQUIRED_DOCS_BUCKET = 'student-required-documents'
const SEED_OBJECT_NAME = 'T3-seed-phase2.pdf'

// Minimal valid PDF. The download/RLS tests only care about the object PATH
// (folder[1] = student_id drives storage RLS), not the bytes — but use real
// %PDF magic bytes so the object is well-formed for the bucket's MIME allowlist.
const TINY_PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

export type Phase2Fixtures = {
  schoolId: string
  /** application on `shared` (owned by fe_consultant + be_consultant) — positive actor */
  appSharedId: string
  /** application on `feB` (owned by fe_manager only) — non-owner-deny target for fe_consultant */
  appFeBId: string
  /** storage object under feA (owned by fe_consultant) */
  objFeA: string
  /** storage object under feB (owned by fe_manager only) */
  objFeB: string
}

/** Required-document storage path; folder[1] = student_id is what storage RLS keys off. */
export function storagePathFor(studentId: string): string {
  return `${studentId}/${SEED_OBJECT_NAME}`
}

export async function seedPhase2(
  fx: Fixtures,
  sb: SupabaseClient = service(),
): Promise<Phase2Fixtures> {
  // School — FK target for applications. schools_write RLS is manager-only, so
  // seed via service-role. Prefix-tagged for teardown.
  const { data: school, error: sErr } = await sb
    .from('schools')
    .insert({
      name_en: `${SCHOOL_PREFIX}Test University`,
      name_zh: `${SCHOOL_PREFIX}測試大學`,
      country: 'US',
      is_partner: false,
    })
    .select('id')
    .single()
  if (sErr) throw new Error('seedPhase2 school: ' + sErr.message)
  const schoolId = (school as { id: string }).id

  // Applications (only NOT NULLs are student_id + school_id; status defaults).
  const insApp = async (studentId: string) => {
    const { data, error } = await sb
      .from('applications')
      .insert({ student_id: studentId, school_id: schoolId })
      .select('id')
      .single()
    if (error) throw new Error('seedPhase2 application: ' + error.message)
    return (data as { id: string }).id
  }
  const appSharedId = await insApp(fx.studentIds.shared)
  const appFeBId = await insApp(fx.studentIds.feB)

  // Storage objects for the signed-URL flow. Path folder[1] = student_id.
  const objFeA = storagePathFor(fx.studentIds.feA)
  const objFeB = storagePathFor(fx.studentIds.feB)
  for (const path of [objFeA, objFeB]) {
    const { error } = await sb.storage
      .from(REQUIRED_DOCS_BUCKET)
      .upload(path, TINY_PDF, { contentType: 'application/pdf', upsert: true })
    if (error) throw new Error('seedPhase2 storage upload: ' + error.message)
  }

  return { schoolId, appSharedId, appFeBId, objFeA, objFeB }
}

export async function teardownPhase2(fx: Fixtures, sb: SupabaseClient = service()): Promise<void> {
  const ids = Object.values(fx.studentIds)
  // FK-safe order, run BEFORE teardownFixtures():
  //  - word_quota_ledger.related_deal_id → deals (no cascade) ⇒ ledger before deals
  //  - deals.student_id has NO cascade from students ⇒ must delete before students
  //    (deal_commission_splits cascades from deals)
  //  - applications before schools (applications.school_id → schools, no cascade)
  await sb.from('word_quota_ledger').delete().in('student_id', ids)
  await sb.from('deals').delete().in('student_id', ids)
  await sb.from('student_credentials').delete().in('student_id', ids)
  await sb.from('applications').delete().in('student_id', ids)
  await sb.from('schools').delete().like('name_en', `${SCHOOL_PREFIX}%`)
  // Storage objects are not FK-cascaded — remove explicitly.
  await sb.storage
    .from(REQUIRED_DOCS_BUCKET)
    .remove([storagePathFor(fx.studentIds.feA), storagePathFor(fx.studentIds.feB)])
}
