-- ============================================================================
-- 0031 — student_defers (Defer 延後入學) per spec § 2.3
-- ============================================================================
-- A student can be deferred multiple times; each row captures one deferral.
-- Front-end UI shows the latest by created_at on the student page.
-- agreement_file_path is required because the consent letter is a contractual
-- artefact — without it we don't accept the defer.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_defers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  original_enrollment_date DATE,
  new_enrollment_date DATE NOT NULL,
  reason TEXT,
  agreement_file_path TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_defers_student
  ON public.student_defers(student_id, created_at DESC);

ALTER TABLE public.student_defers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_defers_select ON public.student_defers;
CREATE POLICY student_defers_select ON public.student_defers
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_student_consultant(student_id));

CREATE OR REPLACE FUNCTION public.create_student_defer(
  p_student_id UUID,
  p_original_enrollment_date DATE,
  p_new_enrollment_date DATE,
  p_reason TEXT,
  p_agreement_file_path TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IN ('manager_frontend', 'manager_backend', 'admin') THEN
    v_authorized := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.students
      WHERE id = p_student_id
        AND deleted_at IS NULL
        AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
    ) INTO v_authorized;
  END IF;
  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限為此學生 Defer' USING ERRCODE = '42501';
  END IF;

  IF p_new_enrollment_date IS NULL THEN
    RAISE EXCEPTION '新入學日期必填';
  END IF;
  IF p_agreement_file_path IS NULL OR length(trim(p_agreement_file_path)) = 0 THEN
    RAISE EXCEPTION '同意書必填';
  END IF;

  INSERT INTO public.student_defers (
    student_id, original_enrollment_date, new_enrollment_date,
    reason, agreement_file_path, created_by
  ) VALUES (
    p_student_id, p_original_enrollment_date, p_new_enrollment_date,
    NULLIF(trim(coalesce(p_reason, '')), ''),
    trim(p_agreement_file_path),
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(), 'student_deferred', 'student_defer', v_id,
    jsonb_build_object('new_enrollment_date', p_new_enrollment_date)
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_student_defer(UUID, DATE, DATE, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
