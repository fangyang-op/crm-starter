-- ============================================================================
-- 0020 — academic_scores CRUD via SECURITY DEFINER
-- ============================================================================
--
-- Phase 4.3 wires up score management. RLS for academic_scores uses the
-- usual is_manager_or_admin() / is_student_consultant() pair which has
-- the WITH CHECK quirk we route around with SD functions throughout this
-- codebase.
--
-- Permission: manager+/admin OR consultant of the relevant student.
--
-- File flow (handled by the action layer, not this migration):
--   1. Action calls create_academic_score with certificate_storage_path = NULL
--      to obtain the new score id.
--   2. Action uploads the file to {student_id}/{score_id}/{filename}.
--   3. Action calls update_academic_score with the resolved path.
--   This two-phase approach is what lets the storage path embed the score
--   id; the alternative (uuid-then-rename) costs an extra storage op.
--
-- delete_academic_score returns the storage path it freed so the action can
-- delete the file outside the transaction. We can't call storage APIs from
-- plpgsql safely (the storage extension wants service_role), so the action
-- layer owns that step.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._score_authorize(p_student_id UUID)
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
    RETURN;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = p_student_id
      AND deleted_at IS NULL
      AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
  ) INTO v_authorized;
  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限操作此學生成績' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._score_authorize(UUID) FROM PUBLIC;

-- ============================================================================
-- create_academic_score — initial insert (caller usually omits cert path,
-- then calls update_academic_score after the upload completes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_academic_score(
  p_student_id UUID,
  p_score_type TEXT,
  p_total_score TEXT,
  p_sub_scores JSONB,
  p_test_date DATE,
  p_expiry_date DATE,
  p_certificate_storage_path TEXT,
  p_is_official BOOLEAN,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_score_type score_type;
BEGIN
  PERFORM public._score_authorize(p_student_id);

  BEGIN
    v_score_type := p_score_type::score_type;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '無效的成績類型: %', p_score_type;
  END;

  INSERT INTO public.academic_scores (
    student_id, score_type, total_score, sub_scores,
    test_date, expiry_date, certificate_storage_path,
    is_official, notes, created_by
  ) VALUES (
    p_student_id,
    v_score_type,
    NULLIF(trim(coalesce(p_total_score, '')), ''),
    p_sub_scores,
    p_test_date,
    p_expiry_date,
    NULLIF(trim(coalesce(p_certificate_storage_path, '')), ''),
    COALESCE(p_is_official, FALSE),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(), 'score_added', 'academic_score', v_id,
    jsonb_build_object('score_type', v_score_type, 'total_score', p_total_score)
  );

  RETURN v_id;
END;
$$;

-- ============================================================================
-- update_academic_score — full update; pass current values for fields you
-- don't want to change (callers always pass the full form anyway)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_academic_score(
  p_id UUID,
  p_score_type TEXT,
  p_total_score TEXT,
  p_sub_scores JSONB,
  p_test_date DATE,
  p_expiry_date DATE,
  p_certificate_storage_path TEXT,
  p_is_official BOOLEAN,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_score_type score_type;
BEGIN
  SELECT student_id INTO v_student_id FROM public.academic_scores WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '成績不存在';
  END IF;

  PERFORM public._score_authorize(v_student_id);

  BEGIN
    v_score_type := p_score_type::score_type;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '無效的成績類型: %', p_score_type;
  END;

  UPDATE public.academic_scores SET
    score_type = v_score_type,
    total_score = NULLIF(trim(coalesce(p_total_score, '')), ''),
    sub_scores = p_sub_scores,
    test_date = p_test_date,
    expiry_date = p_expiry_date,
    certificate_storage_path = NULLIF(trim(coalesce(p_certificate_storage_path, '')), ''),
    is_official = COALESCE(p_is_official, FALSE),
    notes = NULLIF(trim(coalesce(p_notes, '')), '')
  WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'score_updated', 'academic_score', p_id,
    jsonb_build_object('score_type', v_score_type, 'total_score', p_total_score)
  );
END;
$$;

-- ============================================================================
-- delete_academic_score — returns the storage path so the action layer can
-- unlink the file in storage (plpgsql can't safely call storage APIs)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_academic_score(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_path TEXT;
BEGIN
  SELECT student_id, certificate_storage_path INTO v_student_id, v_path
  FROM public.academic_scores WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '成績不存在';
  END IF;

  PERFORM public._score_authorize(v_student_id);

  DELETE FROM public.academic_scores WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'score_deleted', 'academic_score', p_id,
    jsonb_build_object('had_certificate', v_path IS NOT NULL)
  );

  RETURN v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_academic_score(UUID, TEXT, TEXT, JSONB, DATE, DATE, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_academic_score(UUID, TEXT, TEXT, JSONB, DATE, DATE, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_academic_score(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
