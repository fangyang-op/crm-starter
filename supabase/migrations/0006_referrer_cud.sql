-- ============================================================================
-- 0006 — Referrer CRUD via SECURITY DEFINER stored functions
-- ============================================================================
--
-- The referrers_write policy uses is_manager_or_admin(), the same helper
-- that misbehaves under WITH CHECK on students UPDATE (see 0004 / 0005 for
-- background). To be safe, all referrer mutations go through SECURITY
-- DEFINER functions with their own permission check. SELECT continues to
-- use the existing RLS policy (USING TRUE for authenticated).
--
-- Permission: manager_frontend / manager_backend / admin only (matches the
-- original RLS intent).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_referrer(
  p_name TEXT,
  p_type TEXT,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('manager_frontend', 'manager_backend', 'admin') THEN
    RAISE EXCEPTION '無權限' USING ERRCODE = '42501';
  END IF;

  IF p_type NOT IN ('individual', 'organization', 'school', 'partner') THEN
    RAISE EXCEPTION '無效的轉介人類型: %', p_type;
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION '姓名必填';
  END IF;

  INSERT INTO public.referrers (name, type, contact_email, contact_phone, notes)
  VALUES (
    trim(p_name),
    p_type,
    NULLIF(trim(coalesce(p_contact_email, '')), ''),
    NULLIF(trim(coalesce(p_contact_phone, '')), ''),
    NULLIF(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_referrer(
  p_id UUID,
  p_name TEXT,
  p_type TEXT,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role NOT IN ('manager_frontend', 'manager_backend', 'admin') THEN
    RAISE EXCEPTION '無權限' USING ERRCODE = '42501';
  END IF;

  IF p_type NOT IN ('individual', 'organization', 'school', 'partner') THEN
    RAISE EXCEPTION '無效的轉介人類型: %', p_type;
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION '姓名必填';
  END IF;

  UPDATE public.referrers
  SET
    name = trim(p_name),
    type = p_type,
    contact_email = NULLIF(trim(coalesce(p_contact_email, '')), ''),
    contact_phone = NULLIF(trim(coalesce(p_contact_phone, '')), ''),
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到此轉介人';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_referrer(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_referrer(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_referrer(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_referrer(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ============================================================================
-- DONE.
-- 驗證:manager / admin 應能建立、修改、停用轉介人。consultant 應收到「無權限」。
-- ============================================================================
