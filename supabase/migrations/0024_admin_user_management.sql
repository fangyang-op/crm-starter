-- ============================================================================
-- 0024 — Admin user management SD helpers + profiles.created_by
-- ============================================================================
--
-- Spec § 1.2: admins create, edit, and deactivate user accounts.
--
-- Auth-side actions (creating an auth.users row, updating its password,
-- disabling it) live in the action layer behind the service-role admin
-- client (lib/supabase/admin.ts) — plpgsql can't safely call those.
-- This migration owns the **profile-side** mirror operations and a couple
-- of guards plpgsql does well:
--
--   * admin_create_user_profile  — INSERT public.profiles after auth.admin.createUser
--                                  succeeds. Records who created the row.
--   * admin_update_user_profile  — UPDATE name / role / department, with the
--                                  self-protection rule (admin cannot downgrade
--                                  themselves out of admin).
--   * admin_set_user_active      — flip is_active. Admin cannot disable self.
--
-- All three are SECURITY DEFINER and explicitly require admin on the caller.
-- The auth-side disable (auth.admin.updateUserById({ban_duration})) is invoked
-- from the action after admin_set_user_active(false) succeeds.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public._admin_user_authorize()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION '只有 Admin 可管理帳號' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._admin_user_authorize() FROM PUBLIC;

-- ============================================================================
-- admin_create_user_profile
-- ============================================================================
-- Caller has just created an auth.users row via service role; we mirror it
-- into public.profiles. The auth user id is what binds the two together
-- (profiles.id REFERENCES auth.users(id) ON DELETE CASCADE — see 0001).
--
-- We deliberately accept role + department here rather than defaulting them,
-- because the create form always asks for both.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_display_name TEXT,
  p_role TEXT,
  p_department TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role;
DECLARE v_dept department;
BEGIN
  PERFORM public._admin_user_authorize();

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION '姓名必填';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email 必填';
  END IF;

  BEGIN v_role := p_role::user_role;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '無效的角色: %', p_role;
  END;

  IF p_department IS NULL OR length(trim(p_department)) = 0 THEN
    v_dept := NULL;
  ELSE
    BEGIN v_dept := p_department::department;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '無效的部門: %', p_department;
    END;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, display_name, role, department, is_active, created_by
  ) VALUES (
    p_user_id,
    trim(p_email),
    trim(p_full_name),
    NULLIF(trim(coalesce(p_display_name, '')), ''),
    v_role,
    v_dept,
    TRUE,
    auth.uid()
  );
END;
$$;

-- ============================================================================
-- admin_update_user_profile — name / role / department
-- ============================================================================
-- Self-protection: admin cannot downgrade themselves out of admin. We do
-- this in plpgsql so even a malicious direct RPC can't bypass it.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_display_name TEXT,
  p_role TEXT,
  p_department TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role;
DECLARE v_dept department;
BEGIN
  PERFORM public._admin_user_authorize();

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION '姓名必填';
  END IF;
  BEGIN v_role := p_role::user_role;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '無效的角色: %', p_role;
  END;
  IF p_department IS NULL OR length(trim(p_department)) = 0 THEN
    v_dept := NULL;
  ELSE
    BEGIN v_dept := p_department::department;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '無效的部門: %', p_department;
    END;
  END IF;

  IF p_user_id = auth.uid() AND v_role <> 'admin' THEN
    RAISE EXCEPTION '不可將自己的角色降級' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET
    full_name = trim(p_full_name),
    display_name = NULLIF(trim(coalesce(p_display_name, '')), ''),
    role = v_role,
    department = v_dept,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到帳號';
  END IF;
END;
$$;

-- ============================================================================
-- admin_set_user_active
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_user_active(
  p_user_id UUID,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._admin_user_authorize();

  IF p_user_id = auth.uid() AND p_is_active = FALSE THEN
    RAISE EXCEPTION '不可停用自己的帳號' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到帳號';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
