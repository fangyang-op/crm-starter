-- ============================================================================
-- 0038 — find_duplicate_student_by_phone (duplicate-prevention §2A)
-- ============================================================================
--
-- The "新增學生" form blurs the phone input and asks the server: does this
-- number already match an existing student? Without SECURITY DEFINER the
-- caller would only see students within their own RLS scope, so a frontend
-- consultant trying to add a student already owned by a different
-- consultant would get a false "no duplicate" — defeating the warning.
--
-- The function returns at most one row (LIMIT 1). It's a UX nicety: the
-- DB UNIQUE constraint (0037) is the actual safety net.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_duplicate_student_by_phone(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  english_name TEXT,
  created_at TIMESTAMPTZ,
  frontend_consultant_id UUID,
  frontend_consultant_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  -- Normalise: trim + drop whitespace + drop dashes. Matches the front-end
  -- normalisation; if the user types "0912 345 678" or "0912-345-678" we
  -- still hit the same row stored as "0912345678".
  v_phone := regexp_replace(trim(coalesce(p_phone, '')), '[\s-]+', '', 'g');

  IF v_phone = '' OR length(v_phone) < 8 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.full_name,
    s.english_name,
    s.created_at,
    s.frontend_consultant_id,
    COALESCE(p.display_name, p.full_name) AS frontend_consultant_name
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.frontend_consultant_id
  WHERE s.phone = v_phone
    AND s.deleted_at IS NULL
  ORDER BY s.created_at ASC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_student_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_student_by_phone(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
