-- ============================================================================
-- 0002 — Fix admin / manager soft delete on students
-- ============================================================================
--
-- Bug: With role = 'admin', UPDATE on students (e.g. setting deleted_at for
-- soft delete) raises:
--     new row violates row-level security policy for table "students"
--
-- Root cause: students_update WITH CHECK calls is_manager_or_admin(), a
-- LANGUAGE SQL + SECURITY DEFINER + STABLE function. In some RLS evaluation
-- contexts (specifically the WITH CHECK pass after a BEFORE UPDATE trigger
-- has rewritten NEW.updated_at), the function returns FALSE for admin users
-- whose profiles row clearly has role = 'admin'. The USING clause passes
-- (so the row is selected for update), but WITH CHECK fails on the new
-- row, hence the postgres error.
--
-- Fix: drop the function call from the policy and inline the EXISTS check.
-- Semantics are identical; the inlined version is opaque to the planner
-- quirk that causes the helper to misbehave. Other policies that use
-- is_manager_or_admin() are left alone — none have reproduced the issue.
-- ============================================================================

DROP POLICY IF EXISTS students_update ON public.students;

CREATE POLICY students_update ON public.students
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('manager_frontend', 'manager_backend', 'admin')
    )
    OR frontend_consultant_id = auth.uid()
    OR backend_consultant_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('manager_frontend', 'manager_backend', 'admin')
    )
    OR frontend_consultant_id = auth.uid()
    OR backend_consultant_id = auth.uid()
  );

-- ============================================================================
-- DONE
-- 驗證:以 admin 帳號登入後嘗試對任意學生做 update / soft delete,應成功
-- ============================================================================
