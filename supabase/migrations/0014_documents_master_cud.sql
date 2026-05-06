-- ============================================================================
-- 0014 — documents_master + documents_master_versions via SECURITY DEFINER
-- ============================================================================
--
-- documents_master / documents_master_versions RLS uses
-- is_manager_or_admin() / is_student_consultant() — same WITH CHECK quirk we
-- route around in this codebase. SD functions enforce permission in plpgsql.
--
-- Permission: manager+/admin OR consultant of the relevant student.
--
-- Word counting + diff are computed in TypeScript (action layer) because
-- plpgsql can't easily do word-level diff. The SD function trusts the
-- caller's word_count + word_diff_from_previous values; on a malicious
-- direct RPC, a consultant could fudge the diff to skip ledger billing —
-- acceptable risk for an internal admin tool with audit trail. A defensive
-- plpgsql recount helper can be added later if abuse appears.
--
-- The existing trg_master_version_ledger trigger (from 0001) automatically
-- writes a 'used' ledger entry whenever NEW.word_diff_from_previous > 0.
-- That trigger function is SECURITY DEFINER and runs as postgres which has
-- BYPASSRLS, so the ledger insert bypasses RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._dm_authorize(p_student_id UUID)
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
    RAISE EXCEPTION '無權限操作此學生文件' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._dm_authorize(UUID) FROM PUBLIC;

-- ============================================================================
-- create_documents_master — create a Master with no versions yet
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_documents_master(
  p_student_id UUID,
  p_doc_type TEXT,
  p_title TEXT,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM public._dm_authorize(p_student_id);

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION '標題必填';
  END IF;
  IF p_doc_type NOT IN ('cv', 'sop', 'lor', 'transcript', 'other') THEN
    RAISE EXCEPTION '無效的文件類型: %', p_doc_type;
  END IF;

  INSERT INTO public.documents_master (
    student_id, doc_type, title, description, current_version_id, created_by
  ) VALUES (
    p_student_id,
    p_doc_type::document_type,
    trim(p_title),
    NULLIF(trim(coalesce(p_description, '')), ''),
    NULL,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- create_documents_master_version — append a new version, set as current
-- ============================================================================
-- The trigger trg_master_version_ledger fires AFTER INSERT and writes the
-- 'used' ledger entry when word_diff_from_previous > 0.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_documents_master_version(
  p_master_id UUID,
  p_content TEXT,
  p_word_count INTEGER,
  p_word_diff_from_previous INTEGER,
  p_change_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_next_version INTEGER;
  v_id UUID;
BEGIN
  SELECT student_id INTO v_student_id FROM public.documents_master WHERE id = p_master_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Master 不存在';
  END IF;

  PERFORM public._dm_authorize(v_student_id);

  IF p_word_count IS NULL OR p_word_count < 0 THEN
    RAISE EXCEPTION 'word_count 必須 >= 0';
  END IF;
  IF p_word_diff_from_previous IS NULL OR p_word_diff_from_previous < 0 THEN
    RAISE EXCEPTION 'word_diff_from_previous 必須 >= 0';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.documents_master_versions WHERE master_id = p_master_id;

  INSERT INTO public.documents_master_versions (
    master_id, version_number, content, word_count,
    word_diff_from_previous, change_note, modified_by
  ) VALUES (
    p_master_id,
    v_next_version,
    coalesce(p_content, ''),
    p_word_count,
    p_word_diff_from_previous,
    NULLIF(trim(coalesce(p_change_note, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  -- Set as current
  UPDATE public.documents_master
  SET current_version_id = v_id, updated_at = NOW()
  WHERE id = p_master_id;

  -- Activity log
  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'document_revised', 'documents_master_version', v_id,
    jsonb_build_object(
      'master_id', p_master_id,
      'version', v_next_version,
      'word_count', p_word_count,
      'word_diff', p_word_diff_from_previous
    )
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_documents_master(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_documents_master_version(UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
