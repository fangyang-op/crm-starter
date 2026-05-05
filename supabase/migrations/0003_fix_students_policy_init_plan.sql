-- ============================================================================
-- 0003 — Fix admin students UPDATE: wrap auth.uid() with (SELECT ...) so the
--        planner uses an InitPlan and evaluates the JWT claim once per
--        statement instead of per-row inside the WITH CHECK pass.
-- ============================================================================
--
-- Symptom (after 0002 inlined the EXISTS check): admin user, role='admin'
-- confirmed via direct SELECT *and* via supabase.rpc('is_manager_or_admin')
-- both return true, yet UPDATE on students still raises:
--     new row violates row-level security policy for table "students"
--
-- Root cause: Supabase RLS quirk with bare `auth.uid()` calls inside
-- WITH CHECK during UPDATE. The recommended workaround per Supabase docs is
-- to wrap with `(SELECT auth.uid())`. This causes the planner to compute it
-- as an InitPlan once per statement, side-stepping the per-row evaluation
-- context that returns NULL/wrong values inside WITH CHECK.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#use-functions-instead-of-row-level-security
-- ============================================================================

DROP POLICY IF EXISTS students_update ON public.students;

CREATE POLICY students_update ON public.students
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('manager_frontend', 'manager_backend', 'admin')
    )
    OR frontend_consultant_id = (SELECT auth.uid())
    OR backend_consultant_id = (SELECT auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('manager_frontend', 'manager_backend', 'admin')
    )
    OR frontend_consultant_id = (SELECT auth.uid())
    OR backend_consultant_id = (SELECT auth.uid())
  );

-- ============================================================================
-- DONE. 驗證:admin 應該能 soft delete / update 任意學生。
-- ============================================================================
