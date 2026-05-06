-- ============================================================================
-- 0027 — academic_scores.status + front-end consultant edit lock
-- ============================================================================
--
-- Spec § 2.4: front-end consultants jot down preliminary scores when they
-- create a student. Back-end consultants take over for confirmation /
-- detail. Front-end can NOT edit scores after creation; the back-end UI
-- inherits the preliminary rows and fills out the rest.
--
-- 1. New academic_scores.status TEXT (preliminary | confirmed). Existing
--    rows default to 'confirmed' (they were created before this rule).
-- 2. update_academic_score / delete_academic_score now reject front-end
--    consultants (role='consultant' AND profile.department='frontend');
--    manager+/admin and back-end consultants pass.
-- ============================================================================

ALTER TABLE public.academic_scores
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('preliminary', 'confirmed'));

-- New helper: same gate as _score_authorize, but additionally blocks
-- front-end consultants from edit/delete operations.
CREATE OR REPLACE FUNCTION public._score_authorize_edit(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_dept department;
  v_authorized BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role, department INTO v_role, v_dept
  FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION '找不到 profile' USING ERRCODE = '42501';
  END IF;
  -- Manager+/admin: always allowed.
  IF v_role IN ('manager_frontend', 'manager_backend', 'admin') THEN
    RETURN;
  END IF;
  -- Front-end consultants are explicitly blocked from editing scores.
  IF v_role = 'consultant' AND v_dept = 'frontend' THEN
    RAISE EXCEPTION '前端顧問不可編輯成績,請交由後端顧問或主管維護'
      USING ERRCODE = '42501';
  END IF;
  -- Other consultants (back-end / 營運): must be assigned to this student.
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
REVOKE ALL ON FUNCTION public._score_authorize_edit(UUID) FROM PUBLIC;

-- Re-emit update_academic_score with the stricter authorize.
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

  PERFORM public._score_authorize_edit(v_student_id);

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
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    -- A back-end edit auto-confirms a preliminary score so the badge clears.
    status = 'confirmed'
  WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'score_updated', 'academic_score', p_id,
    jsonb_build_object('score_type', v_score_type, 'total_score', p_total_score)
  );
END;
$$;

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

  PERFORM public._score_authorize_edit(v_student_id);

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

-- create_academic_score keeps the original _score_authorize so front-end
-- consultants CAN create a preliminary row when filling the new-student form.
-- A new wrapper does the same insert but tags status='preliminary' so the
-- action layer can call it without juggling extra params on every call.
CREATE OR REPLACE FUNCTION public.create_preliminary_score(
  p_student_id UUID,
  p_score_type TEXT,
  p_total_score TEXT,
  p_sub_scores JSONB
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
    is_official, status, created_by
  ) VALUES (
    p_student_id,
    v_score_type,
    NULLIF(trim(coalesce(p_total_score, '')), ''),
    p_sub_scores,
    FALSE,
    'preliminary',
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(), 'score_added', 'academic_score', v_id,
    jsonb_build_object('score_type', v_score_type, 'total_score', p_total_score, 'preliminary', true)
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_preliminary_score(UUID, TEXT, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
