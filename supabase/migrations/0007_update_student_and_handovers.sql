-- ============================================================================
-- 0007 — update_student via SECURITY DEFINER + auto-write consultant_handovers
-- ============================================================================
--
-- Symptom precedent: direct UPDATE on students fails for admin under the
-- Supabase RLS WITH CHECK quirk (see 0004 / 0005). Wrap general student
-- updates in a SECURITY DEFINER function. Also detect frontend / backend
-- consultant changes and write a consultant_handovers row automatically
-- (the existing handovers_insert RLS uses is_manager_or_admin() which
-- shares the same flakiness — bypassed inside SECURITY DEFINER).
--
-- Permission: same as soft delete / status change — manager+/admin can
-- update any student; consultants can only update students where they are
-- the frontend or backend consultant.
--
-- Handover types:
--   frontend_swap        — frontend consultant changed from A to B (both non-null)
--   frontend_to_backend  — backend consultant assigned for the first time (was NULL)
--   backend_swap         — backend consultant changed from A to B (both non-null)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_student(p_id UUID, p_data jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
  v_old_fe UUID;
  v_old_be UUID;
  v_new_fe UUID;
  v_new_be UUID;
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
        AND deleted_at IS NULL
        AND (
          frontend_consultant_id = auth.uid()
          OR backend_consultant_id = auth.uid()
        )
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限編輯此學生' USING ERRCODE = '42501';
  END IF;

  SELECT frontend_consultant_id, backend_consultant_id INTO v_old_fe, v_old_be
  FROM public.students WHERE id = p_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '學生不存在或已刪除';
  END IF;

  v_new_fe := NULLIF(p_data->>'frontend_consultant_id', '')::UUID;
  v_new_be := NULLIF(p_data->>'backend_consultant_id', '')::UUID;

  -- Consultants can never reassign students away from themselves.
  IF v_role NOT IN ('manager_frontend', 'manager_backend', 'admin') THEN
    IF v_old_fe IS DISTINCT FROM v_new_fe OR v_old_be IS DISTINCT FROM v_new_be THEN
      RAISE EXCEPTION '無權限變更顧問派發' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.students SET
    full_name = COALESCE(p_data->>'full_name', full_name),
    english_name = NULLIF(p_data->>'english_name', ''),
    email = NULLIF(p_data->>'email', ''),
    phone = NULLIF(p_data->>'phone', ''),
    line_id = NULLIF(p_data->>'line_id', ''),
    birth_date = NULLIF(p_data->>'birth_date', '')::DATE,
    current_school = NULLIF(p_data->>'current_school', ''),
    current_major = NULLIF(p_data->>'current_major', ''),
    current_degree = NULLIF(p_data->>'current_degree', ''),
    graduation_year = NULLIF(p_data->>'graduation_year', '')::INTEGER,
    target_country = CASE
      WHEN jsonb_typeof(p_data->'target_country') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'target_country'))
      ELSE NULL
    END,
    target_degree = NULLIF(p_data->>'target_degree', ''),
    target_major = NULLIF(p_data->>'target_major', ''),
    target_intake = NULLIF(p_data->>'target_intake', ''),
    lead_source_type = COALESCE(
      (NULLIF(p_data->>'lead_source_type', ''))::lead_source_type,
      lead_source_type
    ),
    lead_source_user_id = NULLIF(p_data->>'lead_source_user_id', '')::UUID,
    lead_source_referrer_id = NULLIF(p_data->>'lead_source_referrer_id', '')::UUID,
    lead_source_note = NULLIF(p_data->>'lead_source_note', ''),
    frontend_consultant_id = v_new_fe,
    backend_consultant_id = v_new_be,
    notes = NULLIF(p_data->>'notes', ''),
    tags = CASE
      WHEN jsonb_typeof(p_data->'tags') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'tags'))
      ELSE NULL
    END
  WHERE id = p_id;

  -- Frontend consultant changed (excluding initial null → X case which
  -- happens in createStudent, not here).
  IF v_old_fe IS DISTINCT FROM v_new_fe AND v_old_fe IS NOT NULL AND v_new_fe IS NOT NULL THEN
    INSERT INTO public.consultant_handovers (
      student_id, handover_type, from_consultant_id, to_consultant_id, initiated_by
    ) VALUES (
      p_id, 'frontend_swap', v_old_fe, v_new_fe, auth.uid()
    );
    INSERT INTO public.activity_log (
      student_id, actor_id, action, entity_type, entity_id, payload
    ) VALUES (
      p_id, auth.uid(), 'consultant_assigned', 'student', p_id,
      jsonb_build_object('role', 'frontend', 'from', v_old_fe, 'to', v_new_fe)
    );
  END IF;

  -- Backend consultant changed.
  IF v_old_be IS DISTINCT FROM v_new_be AND v_new_be IS NOT NULL THEN
    INSERT INTO public.consultant_handovers (
      student_id, handover_type, from_consultant_id, to_consultant_id, initiated_by
    ) VALUES (
      p_id,
      CASE WHEN v_old_be IS NULL THEN 'frontend_to_backend' ELSE 'backend_swap' END,
      v_old_be,
      v_new_be,
      auth.uid()
    );
    INSERT INTO public.activity_log (
      student_id, actor_id, action, entity_type, entity_id, payload
    ) VALUES (
      p_id, auth.uid(), 'consultant_assigned', 'student', p_id,
      jsonb_build_object('role', 'backend', 'from', v_old_be, 'to', v_new_be)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_student(UUID, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_student(UUID, jsonb) TO authenticated;
