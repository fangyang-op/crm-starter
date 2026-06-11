'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { DEPARTMENT_VALUES } from '@/lib/constants/department'
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
  const supabase = await createClient()
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

  const supabase = await createClient()

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

// ============================================================================
// Create new user (admin)
// ============================================================================
const createUserSchema = z.object({
  email: z.string().email('Email 格式錯誤').max(255),
  full_name: z.string().min(1, '姓名必填').max(100),
  display_name: z.string().max(100).optional(),
  role: z.enum(['consultant', 'manager_frontend', 'manager_backend', 'admin']),
  department: z.enum(DEPARTMENT_VALUES).nullable(),
  password: z
    .string()
    .min(8, '密碼至少 8 字元')
    .max(128)
    .regex(/[a-z]/, '密碼需含小寫字母')
    .regex(/[A-Z]/, '密碼需含大寫字母')
    .regex(/\d/, '密碼需含數字'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export type CreateUserResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export async function adminCreateUser(input: CreateUserInput): Promise<CreateUserResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = createUserSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const admin = createAdminClient()
  const supabase = await createClient()

  // Step 1: create auth user. email_confirm: true skips the confirmation
  // email — admin is provisioning the account, the user gets the password
  // out-of-band.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    return {
      ok: false,
      error: `建立帳號失敗:${createErr?.message ?? '未知錯誤'}`,
    }
  }

  const newUserId = created.user.id

  // Step 2: insert the profile row through the SD function (admin-gated,
  // self-protected against role manipulation).
  const { error: profileErr } = await supabase.rpc(
    'admin_create_user_profile' as never,
    {
      p_user_id: newUserId,
      p_email: parsed.data.email,
      p_full_name: parsed.data.full_name,
      p_display_name: parsed.data.display_name ?? null,
      p_role: parsed.data.role,
      p_department: parsed.data.department ?? null,
    } as never,
  )

  if (profileErr) {
    // Roll back the auth user — otherwise we leak a stranded auth row.
    await admin.auth.admin.deleteUser(newUserId)
    return { ok: false, error: `寫入 profile 失敗:${(profileErr as { message: string }).message}` }
  }

  await supabase.from('activity_log').insert({
    student_id: null,
    actor_id: auth.userId,
    action: 'user_created_by_admin',
    entity_type: 'profile',
    entity_id: newUserId,
    payload: {
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      role: parsed.data.role,
    },
  })

  revalidatePath('/settings/users')
  return { ok: true, userId: newUserId }
}

// ============================================================================
// Update user profile (name / role / department)
// ============================================================================
const updateUserProfileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().min(1, '姓名必填').max(100),
  display_name: z.string().max(100).nullable(),
  role: z.enum(['consultant', 'manager_frontend', 'manager_backend', 'admin']),
  department: z.enum(DEPARTMENT_VALUES).nullable(),
})

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>

export async function adminUpdateUserProfile(
  input: UpdateUserProfileInput,
): Promise<AdminUserActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const parsed = updateUserProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: '輸入有錯誤', fieldErrors: flattenZodErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc(
    'admin_update_user_profile' as never,
    {
      p_user_id: parsed.data.user_id,
      p_full_name: parsed.data.full_name,
      p_display_name: parsed.data.display_name,
      p_role: parsed.data.role,
      p_department: parsed.data.department,
    } as never,
  )

  if (error) {
    return { ok: false, error: `更新失敗:${(error as { message: string }).message}` }
  }

  revalidatePath('/settings/users')
  revalidatePath(`/settings/users/${parsed.data.user_id}/edit`)
  return { ok: true }
}

// ============================================================================
// Toggle is_active. When deactivating, also ban the auth user (Supabase
// auth.admin.updateUserById({ ban_duration: 'unlimited' })) so they can't sign in.
// When reactivating, un-ban via { ban_duration: 'none' }.
// ============================================================================
export async function adminSetUserActive(
  userId: string,
  isActive: boolean,
): Promise<AdminUserActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  if (!userId) return { ok: false, error: '缺少 user id' }

  const supabase = await createClient()
  const { error: profileErr } = await supabase.rpc(
    'admin_set_user_active' as never,
    {
      p_user_id: userId,
      p_is_active: isActive,
    } as never,
  )
  if (profileErr) {
    return { ok: false, error: `更新失敗:${(profileErr as { message: string }).message}` }
  }

  // Mirror to auth side so a banned user can't sign in even if their profile
  // is_active=false somehow gets bypassed in code.
  const admin = createAdminClient()
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? 'none' : '876000h', // ~100 years; Supabase has no "permanent ban"
  })
  if (authErr) {
    // Profile already flipped; surface the auth side error so admin can retry.
    return {
      ok: false,
      error: `Profile 已更新但 Auth 同步失敗:${authErr.message}`,
    }
  }

  await supabase.from('activity_log').insert({
    student_id: null,
    actor_id: auth.userId,
    action: isActive ? 'user_reactivated_by_admin' : 'user_deactivated_by_admin',
    entity_type: 'profile',
    entity_id: userId,
  })

  revalidatePath('/settings/users')
  revalidatePath(`/settings/users/${userId}/edit`)
  return { ok: true }
}
