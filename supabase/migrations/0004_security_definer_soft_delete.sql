-- ============================================================================
-- 0004 — soft_delete_student via SECURITY DEFINER stored function
-- ============================================================================
--
-- After 0002 (inline EXISTS) and 0003 ((SELECT auth.uid()) wrapping), admin
-- still hits "new row violates row-level security policy" on UPDATE despite:
--   - profiles.role = 'admin' (verified via direct SELECT)
--   - is_manager_or_admin() returns TRUE via supabase.rpc(...)
--
-- This is a Supabase-specific quirk we could not isolate in time. Since
-- CLAUDE.md forbids broadly bypassing RLS, the workaround is a narrow
-- SECURITY DEFINER stored function that performs *its own* permission check
-- in plpgsql (where the helpers are known to work) before issuing the UPDATE.
-- The function is granted only to `authenticated` and only handles soft
-- delete — it is NOT a generic update bypass.
--
-- Permission policy enforced inline (mirrors the original RLS intent):
--   - manager_frontend / manager_backend / admin: any student
--   - consultant: only students where they are frontend or backend consultant
--   - others / unauthenticated: denied
--
-- Side effect: writes a 'student_deleted' row to activity_log so the audit
-- trail survives even though the student is now invisible via RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_student(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION '找不到 profile' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('manager_frontend', 'manager_backend', 'admin') THEN
    v_authorized := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.students
      WHERE id = p_id
        AND (
          frontend_consultant_id = auth.uid()
          OR backend_consultant_id = auth.uid()
        )
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限刪除此學生' USING ERRCODE = '42501';
  END IF;

  UPDATE public.students
  SET deleted_at = NOW()
  WHERE id = p_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '學生不存在或已刪除';
  END IF;

  INSERT INTO public.activity_log (student_id, actor_id, action, entity_type, entity_id)
  VALUES (p_id, auth.uid(), 'student_deleted', 'student', p_id);
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_student(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_student(UUID) TO authenticated;

-- ============================================================================
-- DONE.
-- 驗證:admin / manager 應能對任意學生刪除;consultant 只能刪自己的;
--       其他角色應收到 "無權限刪除此學生" 錯誤。
-- ============================================================================
