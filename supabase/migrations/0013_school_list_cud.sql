-- ============================================================================
-- 0013 — school_lists + school_list_items via SECURITY DEFINER
-- ============================================================================
--
-- school_lists / school_list_items RLS uses is_manager_or_admin() and
-- is_student_consultant() — both have the WITH CHECK quirk we work around
-- via SD functions throughout this codebase.
--
-- Permission across all functions: manager+/admin OR consultant of the
-- relevant student.
--
-- Locked lists reject any modification (add/update/remove items, but the
-- list metadata itself — set_current — is still allowed). To unlock, use
-- a direct SQL UPDATE as admin (escape hatch — intentionally no unlock
-- function so users can't undo the "rocked" decision in the UI).
-- ============================================================================

-- Helper to enforce permission for a given student_id (called from within
-- each function).
CREATE OR REPLACE FUNCTION public._sl_authorize(p_student_id UUID)
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
    RAISE EXCEPTION '無權限操作此學生選校表' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._sl_authorize(UUID) FROM PUBLIC;

-- ============================================================================
-- create_school_list — new version (optionally copying items from another)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_school_list(
  p_student_id UUID,
  p_name TEXT,
  p_copy_from_list_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_next_version INTEGER;
  v_existing_count INTEGER;
BEGIN
  PERFORM public._sl_authorize(p_student_id);

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION '版本名稱必填';
  END IF;

  -- Source list must belong to the same student (defense against id stealing)
  IF p_copy_from_list_id IS NOT NULL THEN
    PERFORM 1 FROM public.school_lists
    WHERE id = p_copy_from_list_id AND student_id = p_student_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '來源選校表不屬於此學生';
    END IF;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1, COUNT(*)
  INTO v_next_version, v_existing_count
  FROM public.school_lists
  WHERE student_id = p_student_id;

  INSERT INTO public.school_lists (
    student_id, version_number, name, is_locked, is_current, created_by
  ) VALUES (
    p_student_id,
    v_next_version,
    trim(p_name),
    FALSE,
    -- First list ever for this student → set as current automatically
    v_existing_count = 0,
    auth.uid()
  )
  RETURNING id INTO v_id;

  IF p_copy_from_list_id IS NOT NULL THEN
    INSERT INTO public.school_list_items (
      school_list_id, school_id, program_id, program_name_override,
      tier, display_order, notes
    )
    SELECT v_id, school_id, program_id, program_name_override,
           tier, display_order, notes
    FROM public.school_list_items
    WHERE school_list_id = p_copy_from_list_id;
  END IF;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(), 'school_list_created', 'school_list', v_id,
    jsonb_build_object('version', v_next_version, 'name', trim(p_name))
  );

  RETURN v_id;
END;
$$;

-- ============================================================================
-- lock_school_list — flip is_locked to TRUE (one-way; no unlock fn)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lock_school_list(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_version INTEGER;
BEGIN
  SELECT student_id, version_number INTO v_student_id, v_version
  FROM public.school_lists WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '選校表不存在';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  UPDATE public.school_lists SET is_locked = TRUE WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'school_list_locked', 'school_list', p_id,
    jsonb_build_object('version', v_version)
  );
END;
$$;

-- ============================================================================
-- set_current_school_list — flip is_current; ensure exactly one per student
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_current_school_list(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id FROM public.school_lists WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '選校表不存在';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  -- Clear is_current on all of this student's lists, then set on the target
  UPDATE public.school_lists SET is_current = FALSE
  WHERE student_id = v_student_id AND is_current = TRUE;

  UPDATE public.school_lists SET is_current = TRUE WHERE id = p_id;
END;
$$;

-- ============================================================================
-- add_school_list_item — append a school to a list
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_school_list_item(
  p_list_id UUID,
  p_school_id UUID,
  p_program_id UUID,
  p_program_name_override TEXT,
  p_tier TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_locked BOOLEAN;
  v_id UUID;
  v_next_order INTEGER;
BEGIN
  SELECT student_id, is_locked INTO v_student_id, v_locked
  FROM public.school_lists WHERE id = p_list_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '選校表不存在';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION '此版本已鎖定,不可修改';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  IF p_tier NOT IN ('dream', 'reach', 'match', 'safety') THEN
    RAISE EXCEPTION '無效的 tier: %', p_tier;
  END IF;

  -- Verify school exists
  PERFORM 1 FROM public.schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '學校不存在';
  END IF;

  -- Program must belong to the school (if specified)
  IF p_program_id IS NOT NULL THEN
    PERFORM 1 FROM public.school_programs
    WHERE id = p_program_id AND school_id = p_school_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '科系不屬於此學校';
    END IF;
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_next_order
  FROM public.school_list_items WHERE school_list_id = p_list_id;

  INSERT INTO public.school_list_items (
    school_list_id, school_id, program_id, program_name_override,
    tier, display_order, notes
  ) VALUES (
    p_list_id, p_school_id, p_program_id,
    NULLIF(trim(coalesce(p_program_name_override, '')), ''),
    p_tier,
    v_next_order,
    NULLIF(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- update_school_list_item — change tier / display_order / notes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_school_list_item(
  p_id UUID,
  p_tier TEXT,
  p_display_order INTEGER,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_locked BOOLEAN;
BEGIN
  SELECT sl.student_id, sl.is_locked INTO v_student_id, v_locked
  FROM public.school_list_items sli
  JOIN public.school_lists sl ON sl.id = sli.school_list_id
  WHERE sli.id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '項目不存在';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION '此版本已鎖定,不可修改';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  IF p_tier NOT IN ('dream', 'reach', 'match', 'safety') THEN
    RAISE EXCEPTION '無效的 tier: %', p_tier;
  END IF;

  UPDATE public.school_list_items SET
    tier = p_tier,
    display_order = COALESCE(p_display_order, display_order),
    notes = NULLIF(trim(coalesce(p_notes, '')), '')
  WHERE id = p_id;
END;
$$;

-- ============================================================================
-- remove_school_list_item
-- ============================================================================
CREATE OR REPLACE FUNCTION public.remove_school_list_item(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_locked BOOLEAN;
BEGIN
  SELECT sl.student_id, sl.is_locked INTO v_student_id, v_locked
  FROM public.school_list_items sli
  JOIN public.school_lists sl ON sl.id = sli.school_list_id
  WHERE sli.id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '項目不存在';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION '此版本已鎖定,不可修改';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  DELETE FROM public.school_list_items WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_school_list(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_school_list(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_current_school_list(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_school_list_item(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_school_list_item(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_school_list_item(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
