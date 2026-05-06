-- ============================================================================
-- 0030 — student_credentials (visa / housing only) per spec § 2.10
-- ============================================================================
-- Per the user's adjusted spec (2026-05-06): keep applications.portal_*
-- AS-IS for per-school portal credentials. Add a new table that carries
-- visa / housing credentials at the student level once they've enrolled
-- somewhere.
--
-- application_id stays nullable for visa/housing rows (no school binding);
-- a CHECK enforces "portal rows must point at an application" so the
-- column is future-proofed if we ever migrate the per-app portal data
-- here too.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL
    CHECK (credential_type IN ('portal', 'visa', 'housing')),
  label TEXT NOT NULL,
  url TEXT,
  account TEXT,
  password_encrypted TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_credential_app_link CHECK (
    (credential_type = 'portal' AND application_id IS NOT NULL)
    OR (credential_type IN ('visa', 'housing'))
  )
);

CREATE INDEX IF NOT EXISTS idx_student_credentials_student_type
  ON public.student_credentials(student_id, credential_type);

DROP TRIGGER IF EXISTS trg_student_credentials_updated_at ON public.student_credentials;
CREATE TRIGGER trg_student_credentials_updated_at
  BEFORE UPDATE ON public.student_credentials
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_credentials_select ON public.student_credentials;
CREATE POLICY student_credentials_select ON public.student_credentials
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_student_consultant(student_id));

-- ============================================================================
-- SD CRUD (manager+/admin OR consultant assigned to the student).
-- The action layer encrypts plaintext via lib/crypto.ts before calling.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._student_credentials_authorize(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role; v_authorized BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
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
    RAISE EXCEPTION '無權限操作此學生帳密' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._student_credentials_authorize(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_student_credential(
  p_student_id UUID,
  p_credential_type TEXT,
  p_label TEXT,
  p_url TEXT,
  p_account TEXT,
  p_password_encrypted TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM public._student_credentials_authorize(p_student_id);
  IF p_credential_type NOT IN ('visa', 'housing') THEN
    RAISE EXCEPTION '此版本只支援 visa / housing(portal 仍走 applications 表)';
  END IF;
  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION '名稱必填';
  END IF;
  INSERT INTO public.student_credentials (
    student_id, application_id, credential_type, label,
    url, account, password_encrypted, notes, created_by
  ) VALUES (
    p_student_id, NULL, p_credential_type,
    trim(p_label),
    NULLIF(trim(coalesce(p_url, '')), ''),
    NULLIF(trim(coalesce(p_account, '')), ''),
    p_password_encrypted,
    NULLIF(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(),
    CASE WHEN p_credential_type = 'visa' THEN 'visa_credentials_updated'
         ELSE 'housing_credentials_updated' END,
    'student_credential', v_id,
    jsonb_build_object('label', trim(p_label), 'created', true)
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_student_credential(
  p_id UUID,
  p_label TEXT,
  p_url TEXT,
  p_account TEXT,
  p_password_encrypted TEXT,
  p_set_password BOOLEAN,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_student_id UUID; v_type TEXT;
BEGIN
  SELECT student_id, credential_type INTO v_student_id, v_type
  FROM public.student_credentials WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '帳密不存在';
  END IF;
  PERFORM public._student_credentials_authorize(v_student_id);

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RAISE EXCEPTION '名稱必填';
  END IF;

  UPDATE public.student_credentials SET
    label = trim(p_label),
    url = NULLIF(trim(coalesce(p_url, '')), ''),
    account = NULLIF(trim(coalesce(p_account, '')), ''),
    password_encrypted = CASE
      WHEN p_set_password THEN p_password_encrypted
      ELSE password_encrypted
    END,
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    updated_at = NOW()
  WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(),
    CASE WHEN v_type = 'visa' THEN 'visa_credentials_updated'
         ELSE 'housing_credentials_updated' END,
    'student_credential', p_id,
    jsonb_build_object('label', trim(p_label), 'password_changed', p_set_password)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_student_credential(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id
  FROM public.student_credentials WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '帳密不存在';
  END IF;
  PERFORM public._student_credentials_authorize(v_student_id);
  DELETE FROM public.student_credentials WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_student_credential(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_credential(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_credential(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
