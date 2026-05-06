-- ============================================================================
-- 0012 — schools + school_programs CRUD via SECURITY DEFINER
-- ============================================================================
--
-- schools_write / programs_write RLS uses is_manager_or_admin() — same
-- WITH CHECK quirk we've avoided since 0004. Wrap mutations in SD funcs
-- with their own manager+/admin permission check. SELECTs continue via
-- existing schools_select / programs_select policies (USING TRUE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_school(
  p_name_en TEXT,
  p_name_zh TEXT,
  p_short_name TEXT,
  p_country TEXT,
  p_state_or_region TEXT,
  p_city TEXT,
  p_website TEXT,
  p_ranking_qs INTEGER,
  p_ranking_us_news INTEGER,
  p_is_partner BOOLEAN,
  p_partner_commission_rate NUMERIC,
  p_partner_notes TEXT,
  p_is_active BOOLEAN
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

  IF p_name_en IS NULL OR length(trim(p_name_en)) = 0 THEN
    RAISE EXCEPTION '英文名稱必填';
  END IF;
  IF p_country IS NULL THEN
    RAISE EXCEPTION '國家必填';
  END IF;

  INSERT INTO public.schools (
    name_en, name_zh, short_name, country, state_or_region, city, website,
    ranking_qs, ranking_us_news, is_partner, partner_commission_rate, partner_notes, is_active
  ) VALUES (
    trim(p_name_en),
    NULLIF(trim(coalesce(p_name_zh, '')), ''),
    NULLIF(trim(coalesce(p_short_name, '')), ''),
    p_country,
    NULLIF(trim(coalesce(p_state_or_region, '')), ''),
    NULLIF(trim(coalesce(p_city, '')), ''),
    NULLIF(trim(coalesce(p_website, '')), ''),
    p_ranking_qs,
    p_ranking_us_news,
    coalesce(p_is_partner, FALSE),
    p_partner_commission_rate,
    NULLIF(trim(coalesce(p_partner_notes, '')), ''),
    coalesce(p_is_active, TRUE)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_school(
  p_id UUID,
  p_name_en TEXT,
  p_name_zh TEXT,
  p_short_name TEXT,
  p_country TEXT,
  p_state_or_region TEXT,
  p_city TEXT,
  p_website TEXT,
  p_ranking_qs INTEGER,
  p_ranking_us_news INTEGER,
  p_is_partner BOOLEAN,
  p_partner_commission_rate NUMERIC,
  p_partner_notes TEXT,
  p_is_active BOOLEAN
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

  IF p_name_en IS NULL OR length(trim(p_name_en)) = 0 THEN
    RAISE EXCEPTION '英文名稱必填';
  END IF;

  UPDATE public.schools SET
    name_en = trim(p_name_en),
    name_zh = NULLIF(trim(coalesce(p_name_zh, '')), ''),
    short_name = NULLIF(trim(coalesce(p_short_name, '')), ''),
    country = p_country,
    state_or_region = NULLIF(trim(coalesce(p_state_or_region, '')), ''),
    city = NULLIF(trim(coalesce(p_city, '')), ''),
    website = NULLIF(trim(coalesce(p_website, '')), ''),
    ranking_qs = p_ranking_qs,
    ranking_us_news = p_ranking_us_news,
    is_partner = coalesce(p_is_partner, FALSE),
    partner_commission_rate = p_partner_commission_rate,
    partner_notes = NULLIF(trim(coalesce(p_partner_notes, '')), ''),
    is_active = coalesce(p_is_active, TRUE),
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到此學校';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_school_program(
  p_school_id UUID,
  p_program_name TEXT,
  p_degree_level TEXT,
  p_major_category TEXT,
  p_application_deadline_round1 DATE,
  p_application_deadline_round2 DATE,
  p_notes TEXT
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

  IF p_program_name IS NULL OR length(trim(p_program_name)) = 0 THEN
    RAISE EXCEPTION '科系名稱必填';
  END IF;

  INSERT INTO public.school_programs (
    school_id, program_name, degree_level, major_category,
    application_deadline_round1, application_deadline_round2, notes
  ) VALUES (
    p_school_id,
    trim(p_program_name),
    p_degree_level,
    NULLIF(trim(coalesce(p_major_category, '')), ''),
    p_application_deadline_round1,
    p_application_deadline_round2,
    NULLIF(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_school_program(
  p_id UUID,
  p_program_name TEXT,
  p_degree_level TEXT,
  p_major_category TEXT,
  p_application_deadline_round1 DATE,
  p_application_deadline_round2 DATE,
  p_notes TEXT
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

  IF p_program_name IS NULL OR length(trim(p_program_name)) = 0 THEN
    RAISE EXCEPTION '科系名稱必填';
  END IF;

  UPDATE public.school_programs SET
    program_name = trim(p_program_name),
    degree_level = p_degree_level,
    major_category = NULLIF(trim(coalesce(p_major_category, '')), ''),
    application_deadline_round1 = p_application_deadline_round1,
    application_deadline_round2 = p_application_deadline_round2,
    notes = NULLIF(trim(coalesce(p_notes, '')), '')
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到此科系';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_school(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_school(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_school(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_school(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, NUMERIC, TEXT, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.create_school_program(
  UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_school_program(
  UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_school_program(
  UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_school_program(
  UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
