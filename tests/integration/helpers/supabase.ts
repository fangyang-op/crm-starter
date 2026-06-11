import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Relative (not `@/…`) so this helper resolves under both Vitest and Playwright.
import { generateRandomPassword } from '../../../lib/validators/auth'

// ── Credentials ──────────────────────────────────────────────────────────────
// Read from env (loaded by tests/setup.ts from .env.test / .env.local, or
// injected as CI secrets). Accept both TEST_* and the app's NEXT_PUBLIC_* names.
export function getEnv() {
  const url = process.env.TEST_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.TEST_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service =
    process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return null
  return { url, anon, service }
}

export const hasSupabaseCreds = getEnv() !== null

// ── Fixture identity ─────────────────────────────────────────────────────────
const EMAIL_PREFIX = 't3test_'
const STUDENT_PREFIX = '測試學生_T3_'
// Test-user password. Prefer an env value (E2E_TEST_PASSWORD from .env.test /
// CI secret) so it is shared across processes — required for Playwright, whose
// globalSetup (seeds) and test workers (log in) are separate processes. Falls
// back to a runtime-generated value for the single-process Vitest integration
// run. Never a committed literal.
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || generateRandomPassword(20)

export type Role = 'admin' | 'fe_manager' | 'be_manager' | 'fe_consultant' | 'be_consultant'

/** Runtime-generated password, exposed so the Playwright E2E suite can log in
 *  the seeded test users through the real login form. Regenerated each process
 *  run — never a committed secret. */
export const TEST_USER_PASSWORD = TEST_PASSWORD

export function emailFor(role: Role): string {
  return ACCOUNTS.find((a) => a.role === role)!.email
}

const ACCOUNTS: { role: Role; email: string; dbRole: string; dept: string | null }[] = [
  { role: 'admin', email: EMAIL_PREFIX + 'admin@example.com', dbRole: 'admin', dept: null },
  {
    role: 'fe_manager',
    email: EMAIL_PREFIX + 'fe_manager@example.com',
    dbRole: 'manager_frontend',
    dept: 'frontend',
  },
  {
    role: 'be_manager',
    email: EMAIL_PREFIX + 'be_manager@example.com',
    dbRole: 'manager_backend',
    dept: 'backend',
  },
  {
    role: 'fe_consultant',
    email: EMAIL_PREFIX + 'fe_consultant@example.com',
    dbRole: 'consultant',
    dept: 'frontend',
  },
  {
    role: 'be_consultant',
    email: EMAIL_PREFIX + 'be_consultant@example.com',
    dbRole: 'consultant',
    dept: 'backend',
  },
]

const STUDENTS = [
  {
    key: 'feA',
    name: STUDENT_PREFIX + '前端A',
    phone: '0900100001',
    fe: 'fe_consultant',
    be: null,
  },
  { key: 'feB', name: STUDENT_PREFIX + '前端B', phone: '0900100002', fe: 'fe_manager', be: null }, // another owner
  {
    key: 'beA',
    name: STUDENT_PREFIX + '後端A',
    phone: '0900100003',
    fe: 'fe_consultant',
    be: 'be_consultant',
  },
  {
    key: 'shared',
    name: STUDENT_PREFIX + '共用',
    phone: '0900100004',
    fe: 'fe_consultant',
    be: 'be_consultant',
  },
] as const

export type Fixtures = {
  userIds: Record<Role, string>
  studentIds: Record<'feA' | 'feB' | 'beA' | 'shared', string>
  studentPhones: Record<'feA' | 'feB' | 'beA' | 'shared', string>
}

// ── Clients ──────────────────────────────────────────────────────────────────
/** service_role client — SEED / TEARDOWN ONLY (bypasses RLS). Never use to
 *  assert RLS behaviour. */
export function service(): SupabaseClient {
  const e = getEnv()!
  return createClient(e.url, e.service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** anon-key client signed in as a given test user — the RLS-scoped client the
 *  assertions must use. */
export async function signInAs(role: Role): Promise<SupabaseClient> {
  const e = getEnv()!
  const c = createClient(e.url, e.anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const email = ACCOUNTS.find((a) => a.role === role)!.email
  const { error } = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  if (error) throw new Error(`signInAs(${role}): ${error.message}`)
  return c
}

async function findUserByEmail(sb: SupabaseClient, email: string) {
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email === email)
    if (u) return u
    if (data.users.length < 200) break
  }
  return null
}

// ── Seed / teardown ──────────────────────────────────────────────────────────
export async function seedFixtures(): Promise<Fixtures> {
  const sb = service()
  const userIds = {} as Record<Role, string>

  for (const a of ACCOUNTS) {
    let id: string
    const { data, error } = await sb.auth.admin.createUser({
      email: a.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        const u = await findUserByEmail(sb, a.email)
        if (!u) throw new Error('exists but not found: ' + a.email)
        id = u.id
        await sb.auth.admin.updateUserById(id, { password: TEST_PASSWORD, email_confirm: true })
      } else throw error
    } else {
      id = data.user!.id
    }
    userIds[a.role] = id
    const { error: pErr } = await sb
      .from('profiles')
      .upsert(
        {
          id,
          email: a.email,
          full_name: '【T3】' + a.role,
          role: a.dbRole,
          department: a.dept,
          is_active: true,
        },
        { onConflict: 'id' },
      )
    if (pErr) throw new Error('profile upsert ' + a.email + ': ' + pErr.message)
  }

  // status_id (NOT NULL) + lead_source_id (NOT NULL)
  const statusId = await firstId(sb, 'student_statuses', 'new_lead')
  const leadSourceId = await firstId(sb, 'lead_sources', 'self_developed')

  const studentIds = {} as Fixtures['studentIds']
  const studentPhones = {} as Fixtures['studentPhones']
  for (const s of STUDENTS) {
    const fe = userIds[s.fe as Role]
    const be = s.be ? userIds[s.be as Role] : null
    const { data: ex } = await sb
      .from('students')
      .select('id')
      .eq('full_name', s.name)
      .is('deleted_at', null)
      .maybeSingle()
    let sid = (ex as { id?: string } | null)?.id
    if (sid) {
      await sb
        .from('students')
        .update({
          phone: s.phone,
          frontend_consultant_id: fe,
          backend_consultant_id: be,
          status_id: statusId,
          lead_source_id: leadSourceId,
        })
        .eq('id', sid)
    } else {
      const { data: ins, error } = await sb
        .from('students')
        .insert({
          full_name: s.name,
          phone: s.phone,
          frontend_consultant_id: fe,
          backend_consultant_id: be,
          status_id: statusId,
          lead_source_id: leadSourceId,
          created_by: fe,
        })
        .select('id')
        .single()
      if (error) throw new Error('student insert ' + s.name + ': ' + error.message)
      sid = (ins as { id: string }).id
    }
    studentIds[s.key] = sid!
    studentPhones[s.key] = s.phone
  }

  return { userIds, studentIds, studentPhones }
}

async function firstId(sb: SupabaseClient, table: string, code: string): Promise<string> {
  const byCode = await sb.from(table).select('id').eq('code', code).maybeSingle()
  if ((byCode.data as { id?: string } | null)?.id) return (byCode.data as { id: string }).id
  const any = await sb.from(table).select('id').limit(1).maybeSingle()
  const id = (any.data as { id?: string } | null)?.id
  if (!id) throw new Error(`no row in ${table}`)
  return id
}

export async function teardownFixtures(): Promise<void> {
  const sb = service()
  const names = STUDENTS.map((s) => s.name)
  const { data: studs } = await sb.from('students').select('id').in('full_name', names)
  const ids = ((studs ?? []) as { id: string }[]).map((s) => s.id)
  if (ids.length) {
    await sb.from('activity_log').delete().in('student_id', ids)
    await sb.from('student_contacts').delete().in('student_id', ids)
    await sb.from('students').delete().in('id', ids)
  }
  // any lead_sources a leaked test insert may have created
  await sb.from('lead_sources').delete().like('code', 't3test%')
  for (const a of ACCOUNTS) {
    const u = await findUserByEmail(sb, a.email)
    if (u) {
      await sb.from('activity_log').delete().eq('actor_id', u.id)
      await sb.auth.admin.deleteUser(u.id)
    }
  }
}
