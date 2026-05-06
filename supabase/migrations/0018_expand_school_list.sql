-- ============================================================================
-- 0018 — expand_school_list_to_applications via SECURITY DEFINER
-- ============================================================================
--
-- Phase 4.1: turn a locked school_lists version into actual applications
-- rows so the student-facing tracker can begin per-school progress.
--
-- Rules (per docs/04 §4.1 + product call this turn):
--   * The list MUST be is_locked=true. We refuse to expand a draft because
--     items can still be added/removed/reordered, which would create churn
--     in the application table.
--   * For each list_item, we INSERT one applications row with:
--       status = 'pending_send'
--       school_id, program_id, program_name_override copied verbatim
--       source_school_list_item_id = the list_item.id (audit trail)
--   * Idempotent: re-running on the same list (or running on a later list
--     that overlaps with an earlier one) skips items where the student
--     already has an application with the SAME (school_id, program_id)
--     pair. Comparison uses IS NOT DISTINCT FROM so NULL program_ids match
--     each other. We do NOT compare program_name_override — that's a
--     human-typed display fallback, not a key.
--   * On expansion we write one activity_log row capturing
--     {list_id, version, created, skipped} so the timeline shows when the
--     list became real applications.
--
-- Permission: manager+/admin OR consultant of the relevant student
-- (reuses _sl_authorize from 0013).
--
-- Returns jsonb: { "created": INT, "skipped": INT, "total": INT }
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expand_school_list_to_applications(
  p_list_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_locked BOOLEAN;
  v_version INTEGER;
  v_total INTEGER := 0;
  v_created INTEGER := 0;
  v_skipped INTEGER := 0;
  rec RECORD;
  v_dup BOOLEAN;
BEGIN
  SELECT student_id, is_locked, version_number
  INTO v_student_id, v_locked, v_version
  FROM public.school_lists WHERE id = p_list_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '選校表不存在';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  IF NOT v_locked THEN
    RAISE EXCEPTION '只有已鎖定的選校表版本才能展開為申請項。請先鎖定本版,或建立新版本來調整。';
  END IF;

  FOR rec IN
    SELECT id, school_id, program_id, program_name_override
    FROM public.school_list_items
    WHERE school_list_id = p_list_id
    ORDER BY display_order
  LOOP
    v_total := v_total + 1;

    -- Skip if student already has an application with the same school+program.
    -- IS NOT DISTINCT FROM so NULL program_ids treat as equal.
    SELECT EXISTS (
      SELECT 1 FROM public.applications
      WHERE student_id = v_student_id
        AND school_id = rec.school_id
        AND program_id IS NOT DISTINCT FROM rec.program_id
    ) INTO v_dup;

    IF v_dup THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.applications (
      student_id, school_id, program_id, program_name_override,
      source_school_list_item_id, status
    ) VALUES (
      v_student_id, rec.school_id, rec.program_id, rec.program_name_override,
      rec.id, 'pending_send'
    );

    v_created := v_created + 1;
  END LOOP;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'applications_expanded', 'school_list', p_list_id,
    jsonb_build_object(
      'version', v_version,
      'total', v_total,
      'created', v_created,
      'skipped', v_skipped
    )
  );

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.expand_school_list_to_applications(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
