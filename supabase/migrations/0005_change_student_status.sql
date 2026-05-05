-- ============================================================================
-- 0005 — change_student_status via SECURITY DEFINER stored function
-- ============================================================================
--
-- Same Supabase RLS quirk that broke soft delete (see 0004) also blocks
-- admin from running plain UPDATE on students.status. Workaround: a narrow
-- SECURITY DEFINER function that does its own permission check in plpgsql,
-- updates the status, attaches the optional note to the just-written
-- student_status_history row (the existing trg_students_status_history
-- trigger writes the row but with NULL note), and logs to activity_log.
--
-- Permission: manager+/admin can change any student; consultants can change
-- only students where they are frontend or backend consultant.
--
-- NOTE: transition legality (e.g. new_lead can only go to contacted /
-- disqualified / paused) is enforced in the TS server action (see
-- lib/constants/student-status-transitions.ts). Direct RPC callers bypass
-- that check — acceptable for our internal admin tool, can be hardened
-- later if needed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.change_student_status(
  p_id UUID,
  p_new_status student_status,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
  v_old_status student_status;
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
        AND (
          frontend_consultant_id = auth.uid()
          OR backend_consultant_id = auth.uid()
        )
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限變更此學生狀態' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_old_status
  FROM public.students
  WHERE id = p_id AND deleted_at IS NULL;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION '學生不存在或已刪除';
  END IF;

  IF v_old_status = p_new_status THEN
    RAISE EXCEPTION '狀態未變更';
  END IF;

  -- Update status. trg_students_status_history fires AFTER UPDATE OF status
  -- and writes a row to student_status_history (with note = NULL).
  UPDATE public.students SET status = p_new_status WHERE id = p_id;

  -- Attach the note to the just-written history row.
  IF p_note IS NOT NULL AND p_note <> '' THEN
    UPDATE public.student_status_history
    SET note = p_note
    WHERE id = (
      SELECT id FROM public.student_status_history
      WHERE student_id = p_id
        AND from_status = v_old_status
        AND to_status = p_new_status
      ORDER BY changed_at DESC
      LIMIT 1
    );
  END IF;

  -- Log to activity_log so the timeline shows the transition with payload
  -- that the formatter renders into "<actor> 將狀態從 X 改為 Y".
  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_id, auth.uid(), 'status_changed', 'student', p_id,
    jsonb_build_object(
      'from', v_old_status::text,
      'to', p_new_status::text,
      'note', p_note
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.change_student_status(UUID, student_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_student_status(UUID, student_status, TEXT) TO authenticated;

-- ============================================================================
-- DONE.
-- 驗證:admin / manager 可變更任意學生狀態;consultant 僅可變更自己負責的;
--       時間軸應顯示 "<actor> 將狀態從 X 改為 Y";student_status_history 應
--       有對應 row 與選填 note。
-- ============================================================================
