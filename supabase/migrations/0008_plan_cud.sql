-- ============================================================================
-- 0008 — service_plans CRUD via SECURITY DEFINER stored functions
-- ============================================================================
--
-- service_plans RLS allows write only to admin (`plans_write USING is_admin()`).
-- The is_admin() helper has the same WITH CHECK quirk as is_manager_or_admin(),
-- so we wrap mutations in SECURITY DEFINER functions with their own admin
-- check. Read continues via the existing `plans_select USING TRUE` policy.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_service_plan(
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_base_price NUMERIC,
  p_currency TEXT,
  p_included_school_count INTEGER,
  p_included_word_quota INTEGER,
  p_scope_country TEXT[],
  p_scope_degree TEXT[],
  p_is_active BOOLEAN,
  p_display_order INTEGER
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
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION '僅 admin 可管理服務方案' USING ERRCODE = '42501';
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION '方案代碼必填';
  END IF;

  INSERT INTO public.service_plans (
    code, name, description, base_price, currency,
    included_school_count, included_word_quota,
    scope_country, scope_degree, is_active, display_order
  ) VALUES (
    upper(trim(p_code)),
    trim(p_name),
    NULLIF(trim(coalesce(p_description, '')), ''),
    p_base_price,
    coalesce(NULLIF(trim(p_currency), ''), 'TWD'),
    p_included_school_count,
    p_included_word_quota,
    p_scope_country,
    p_scope_degree,
    coalesce(p_is_active, TRUE),
    coalesce(p_display_order, 0)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_service_plan(
  p_id UUID,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_base_price NUMERIC,
  p_currency TEXT,
  p_included_school_count INTEGER,
  p_included_word_quota INTEGER,
  p_scope_country TEXT[],
  p_scope_degree TEXT[],
  p_is_active BOOLEAN,
  p_display_order INTEGER
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
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION '僅 admin 可管理服務方案' USING ERRCODE = '42501';
  END IF;

  UPDATE public.service_plans SET
    code = upper(trim(p_code)),
    name = trim(p_name),
    description = NULLIF(trim(coalesce(p_description, '')), ''),
    base_price = p_base_price,
    currency = coalesce(NULLIF(trim(p_currency), ''), 'TWD'),
    included_school_count = p_included_school_count,
    included_word_quota = p_included_word_quota,
    scope_country = p_scope_country,
    scope_degree = p_scope_degree,
    is_active = coalesce(p_is_active, TRUE),
    display_order = coalesce(p_display_order, 0),
    updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到此方案';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_service_plan(
  TEXT, TEXT, TEXT, NUMERIC, TEXT, INTEGER, INTEGER, TEXT[], TEXT[], BOOLEAN, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_service_plan(
  TEXT, TEXT, TEXT, NUMERIC, TEXT, INTEGER, INTEGER, TEXT[], TEXT[], BOOLEAN, INTEGER
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_service_plan(
  UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INTEGER, INTEGER, TEXT[], TEXT[], BOOLEAN, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_service_plan(
  UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INTEGER, INTEGER, TEXT[], TEXT[], BOOLEAN, INTEGER
) TO authenticated;
