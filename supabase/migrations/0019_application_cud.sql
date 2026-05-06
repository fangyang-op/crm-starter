-- ============================================================================
-- 0019 — applications mutations via SECURITY DEFINER
-- ============================================================================
--
-- Phase 4.2 wires up status / metadata / portal-credential edits. RLS for
-- public.applications uses the same is_manager_or_admin() / is_student_consultant()
-- pair we route around with SD functions throughout this codebase.
--
-- Permission model (same as 0014/0015): manager+/admin OR consultant of the
-- relevant student. Helper _app_authorize centralizes the check.
--
-- Encryption: portal_password_encrypted is stored as the AES-256-GCM
-- ciphertext produced by lib/crypto.ts. The DB never sees plaintext and the
-- key never enters Supabase. update_application_portal accepts the
-- already-encrypted blob and a boolean p_set_password so the UI can choose
-- between "leave password alone", "set new password" (encrypted), and
-- "clear password" (set to NULL). Without the boolean, NULL would overload
-- with "no change", and we'd lose the ability to clear.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._app_authorize(p_student_id UUID)
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
    RAISE EXCEPTION '無權限操作此學生申請' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._app_authorize(UUID) FROM PUBLIC;

-- ============================================================================
-- update_application_status — change status + stamp side-effect timestamps
-- ============================================================================
-- Side effects (idempotent — only set when currently NULL):
--   submitted_at  = NOW() when status becomes 'submitted'
--   decision_at   = NOW() when status becomes a decision-bearing terminal
--                   ('admitted' | 'rejected' | 'waitlisted' |
--                    'declined_by_us' | 'enrolled')
-- We never clear timestamps on rollback (e.g. 'submitted' -> 'pending_send'
-- keeps submitted_at) — manager can correct via direct SQL if needed; the
-- ledger of "we know when it was submitted" is more valuable than tidy state.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_application_status(
  p_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_old_status application_status;
  v_new_status application_status;
BEGIN
  SELECT student_id, status INTO v_student_id, v_old_status
  FROM public.applications WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;

  PERFORM public._app_authorize(v_student_id);

  BEGIN
    v_new_status := p_status::application_status;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '無效的申請狀態: %', p_status;
  END;

  UPDATE public.applications
  SET status = v_new_status,
      submitted_at = CASE
        WHEN v_new_status = 'submitted' AND submitted_at IS NULL THEN NOW()
        ELSE submitted_at
      END,
      decision_at = CASE
        WHEN v_new_status IN ('admitted','rejected','waitlisted','declined_by_us','enrolled')
             AND decision_at IS NULL THEN NOW()
        ELSE decision_at
      END,
      updated_at = NOW()
  WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'application_status_changed', 'application', p_id,
    jsonb_build_object('from', v_old_status, 'to', v_new_status)
  );
END;
$$;

-- ============================================================================
-- update_application_meta — round / deadline / fee / fee_paid / notes
-- ============================================================================
-- decision_notes is also editable here (deliberately bundled because they're
-- both written by the same human in the same edit session).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_application_meta(
  p_id UUID,
  p_application_round TEXT,
  p_deadline DATE,
  p_application_fee NUMERIC,
  p_application_fee_paid BOOLEAN,
  p_notes TEXT,
  p_decision_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id FROM public.applications WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;

  PERFORM public._app_authorize(v_student_id);

  IF p_application_fee IS NOT NULL AND p_application_fee < 0 THEN
    RAISE EXCEPTION '申請費不能為負數';
  END IF;

  UPDATE public.applications SET
    application_round = NULLIF(trim(coalesce(p_application_round, '')), ''),
    deadline = p_deadline,
    application_fee = p_application_fee,
    application_fee_paid = COALESCE(p_application_fee_paid, FALSE),
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    decision_notes = NULLIF(trim(coalesce(p_decision_notes, '')), ''),
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

-- ============================================================================
-- update_application_portal — URL / username / password / notes
-- ============================================================================
-- p_set_password semantics:
--   FALSE → ignore p_portal_password_encrypted, leave the column alone
--   TRUE  → write p_portal_password_encrypted verbatim
--           (NULL means "user cleared the password")
-- The action layer is responsible for AES-256-GCM-encrypting the plaintext
-- via lib/crypto.ts BEFORE calling this function; the DB never sees plaintext.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_application_portal(
  p_id UUID,
  p_portal_url TEXT,
  p_portal_username TEXT,
  p_portal_password_encrypted TEXT,
  p_set_password BOOLEAN,
  p_portal_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id FROM public.applications WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;

  PERFORM public._app_authorize(v_student_id);

  UPDATE public.applications SET
    portal_url = NULLIF(trim(coalesce(p_portal_url, '')), ''),
    portal_username = NULLIF(trim(coalesce(p_portal_username, '')), ''),
    portal_password_encrypted = CASE
      WHEN p_set_password THEN p_portal_password_encrypted
      ELSE portal_password_encrypted
    END,
    portal_notes = NULLIF(trim(coalesce(p_portal_notes, '')), ''),
    updated_at = NOW()
  WHERE id = p_id;

  -- Audit only the *fact* of a portal-password change, never the value.
  IF p_set_password THEN
    INSERT INTO public.activity_log (
      student_id, actor_id, action, entity_type, entity_id, payload
    ) VALUES (
      v_student_id, auth.uid(), 'application_portal_password_changed', 'application', p_id,
      jsonb_build_object('cleared', p_portal_password_encrypted IS NULL)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_application_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_application_meta(UUID, TEXT, DATE, NUMERIC, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_application_portal(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
