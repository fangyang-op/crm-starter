'use server'

import { revalidatePath } from 'next/cache'

import { isAdmin, type UserRole } from '@/lib/constants/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { adminResetPasswordSchema, type AdminResetPasswordInput } from '@/lib/validators/auth'

export type AdminUserActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

function flattenZodErrors(err: import('zod').ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const path = issue.path.join('.')
    if (!result[path]) result[path] = []
    result[path].push(issue.message)
  }
  return result
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登入' }

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!me || !isAdmin(me.role as UserRole)) {
    return { ok: false, error: '無權限' }
  }
  return { ok: true, userId: user.id }
}

export async function resetUserPassword(
  input: AdminResetPasswordInput,
): Promise<AdminUserActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const parsed = adminResetPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = createClient()

  // Confirm the target exists in profiles. We don't blindly trust the uuid.
  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', parsed.data.user_id)
    .maybeSingle()
  if (!target) {
    return { ok: false, error: '找不到該帳號' }
  }

  const admin = createAdminClient()
  const { error: updateErr } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    password: parsed.data.new_password,
  })
  if (updateErr) {
    return { ok: false, error: `重置失敗:${updateErr.message}` }
  }

  // Audit. activity_log.student_id is nullable in 0001 schema, so this row
  // has no associated student — that's intentional, this is a system event.
  await supabase.from('activity_log').insert({
    student_id: null,
    actor_id: auth.userId,
    action: 'password_reset_by_admin',
    entity_type: 'profile',
    entity_id: parsed.data.user_id,
    payload: { target_name: target.full_name },
  })

  revalidatePath(`/settings/users/${parsed.data.user_id}/edit`)
  return { ok: true }
}
