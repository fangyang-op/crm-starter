-- ============================================================================
-- 0015 — documents_variants + documents_variant_versions via SECURITY DEFINER
-- ============================================================================
--
-- Per docs/08 §4:
--   - Fork = insert documents_variants row + insert documents_variant_versions
--     v1 (content copied from chosen master version, word_diff_from_previous = 0)
--   - Fork itself does NOT bill the student. The trigger
--     trg_variant_version_ledger (from 0001) only writes a 'used' ledger row
--     when word_diff_from_previous > 0, so v1 with diff=0 produces no charge.
--   - Subsequent variant edits go through create_documents_variant_version
--     and do bill the student normally (same trigger writes the ledger row).
--   - Variants cannot be re-forked; only Master can be forked.
--
-- Permission: manager+/admin OR consultant of the relevant student
-- (same _dm_authorize helper from 0014).
-- ============================================================================

-- ============================================================================
-- fork_documents_variant — create variant + initial v1 (zero-cost copy)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fork_documents_variant(
  p_master_id UUID,
  p_application_id UUID,
  p_source_master_version_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_student_id UUID;
  v_app_student_id UUID;
  v_variant_id UUID;
  v_v1_id UUID;
  v_source_content TEXT;
  v_source_word_count INTEGER;
BEGIN
  -- Master must exist and we capture its student_id
  SELECT student_id INTO v_master_student_id
  FROM public.documents_master WHERE id = p_master_id;
  IF v_master_student_id IS NULL THEN
    RAISE EXCEPTION 'Master 不存在';
  END IF;

  -- Application must exist and belong to the same student (defense)
  SELECT student_id INTO v_app_student_id
  FROM public.applications WHERE id = p_application_id;
  IF v_app_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;
  IF v_app_student_id <> v_master_student_id THEN
    RAISE EXCEPTION '申請與 Master 不屬於同一位學生';
  END IF;

  PERFORM public._dm_authorize(v_master_student_id);

  -- Source master version must belong to this master
  SELECT content, word_count INTO v_source_content, v_source_word_count
  FROM public.documents_master_versions
  WHERE id = p_source_master_version_id AND master_id = p_master_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '來源版本不屬於這份 Master';
  END IF;

  -- Reject duplicate (UNIQUE(master_id, application_id) would also catch this
  -- but a friendlier error is better)
  PERFORM 1 FROM public.documents_variants
  WHERE master_id = p_master_id AND application_id = p_application_id;
  IF FOUND THEN
    RAISE EXCEPTION '此 Master 已經為這個申請 Fork 過 Variant';
  END IF;

  INSERT INTO public.documents_variants (
    master_id, application_id, forked_from_master_version_id,
    current_version_id, is_finalized, created_by
  ) VALUES (
    p_master_id, p_application_id, p_source_master_version_id,
    NULL, FALSE, auth.uid()
  )
  RETURNING id INTO v_variant_id;

  -- v1: full content copy, diff = 0 → trigger writes nothing to ledger
  INSERT INTO public.documents_variant_versions (
    variant_id, version_number, content, word_count,
    word_diff_from_previous, change_note, modified_by
  ) VALUES (
    v_variant_id,
    1,
    coalesce(v_source_content, ''),
    coalesce(v_source_word_count, 0),
    0,
    'Fork 自 Master',
    auth.uid()
  )
  RETURNING id INTO v_v1_id;

  UPDATE public.documents_variants
  SET current_version_id = v_v1_id
  WHERE id = v_variant_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_master_student_id, auth.uid(), 'document_forked', 'documents_variant', v_variant_id,
    jsonb_build_object(
      'master_id', p_master_id,
      'application_id', p_application_id,
      'forked_from_master_version_id', p_source_master_version_id
    )
  );

  RETURN v_variant_id;
END;
$$;

-- ============================================================================
-- create_documents_variant_version — append a new version, sets as current
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_documents_variant_version(
  p_variant_id UUID,
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
  SELECT dm.student_id INTO v_student_id
  FROM public.documents_variants dv
  JOIN public.documents_master dm ON dm.id = dv.master_id
  WHERE dv.id = p_variant_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Variant 不存在';
  END IF;

  PERFORM public._dm_authorize(v_student_id);

  IF p_word_count IS NULL OR p_word_count < 0 THEN
    RAISE EXCEPTION 'word_count 必須 >= 0';
  END IF;
  IF p_word_diff_from_previous IS NULL OR p_word_diff_from_previous < 0 THEN
    RAISE EXCEPTION 'word_diff_from_previous 必須 >= 0';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.documents_variant_versions WHERE variant_id = p_variant_id;

  INSERT INTO public.documents_variant_versions (
    variant_id, version_number, content, word_count,
    word_diff_from_previous, change_note, modified_by
  ) VALUES (
    p_variant_id,
    v_next_version,
    coalesce(p_content, ''),
    p_word_count,
    p_word_diff_from_previous,
    NULLIF(trim(coalesce(p_change_note, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  UPDATE public.documents_variants
  SET current_version_id = v_id, updated_at = NOW()
  WHERE id = p_variant_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'document_revised', 'documents_variant_version', v_id,
    jsonb_build_object(
      'variant_id', p_variant_id,
      'version', v_next_version,
      'word_count', p_word_count,
      'word_diff', p_word_diff_from_previous
    )
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fork_documents_variant(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_documents_variant_version(UUID, TEXT, INTEGER, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
