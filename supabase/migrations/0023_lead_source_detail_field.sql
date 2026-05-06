-- ============================================================================
-- 0023 — lead_sources.detail_field: explicit "what extra picker to show"
-- ============================================================================
--
-- Issue from product testing: an admin set "連發哥" (a referrer) as the
-- default referrer for "行銷部分配", but the student form still showed
-- the internal-user picker for that source. The student form's "show
-- internal user vs show referrer" decision was hard-coded against the
-- four legacy codes, so default_referrer_id was unreachable on the wrong
-- code.
--
-- Fix: store the picker type on lead_sources itself. Admins can choose
-- when creating a custom source; legacy codes get backfilled to match
-- their historical behavior.
--
-- detail_field values:
--   'none'           — only "lead_source_note" (no extra picker)
--   'internal_user'  — show "來源同事" picker (profiles)
--   'referrer'       — show "轉介人" picker (referrers); default_referrer_id
--                      becomes the prefill
-- ============================================================================

ALTER TABLE public.lead_sources
  ADD COLUMN IF NOT EXISTS detail_field TEXT NOT NULL DEFAULT 'none'
    CHECK (detail_field IN ('none', 'internal_user', 'referrer'));

-- Backfill the seed values to match how the student form originally treated them.
UPDATE public.lead_sources SET detail_field = 'internal_user'
  WHERE code IN ('marketing_dept', 'consultant_referral');

UPDATE public.lead_sources SET detail_field = 'referrer'
  WHERE code IN ('external_referrer', 'brand_introduction');

-- self_developed / other already 'none' via the column default.

-- ============================================================================
-- Replace SD create/update so they accept p_detail_field
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_lead_source(
  p_code TEXT,
  p_label_zh TEXT,
  p_default_referrer_id UUID,
  p_sort_order INT,
  p_detail_field TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM public._lead_source_authorize();
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION '代號必填';
  END IF;
  IF p_label_zh IS NULL OR length(trim(p_label_zh)) = 0 THEN
    RAISE EXCEPTION '中文名稱必填';
  END IF;
  IF p_detail_field NOT IN ('none', 'internal_user', 'referrer') THEN
    RAISE EXCEPTION '無效的詳情欄位類型: %', p_detail_field;
  END IF;
  IF p_detail_field <> 'referrer' AND p_default_referrer_id IS NOT NULL THEN
    RAISE EXCEPTION '只有「轉介人」類型才能設定預設轉介人';
  END IF;

  INSERT INTO public.lead_sources (
    code, label_zh, default_referrer_id, sort_order, detail_field
  ) VALUES (
    trim(p_code),
    trim(p_label_zh),
    p_default_referrer_id,
    COALESCE(p_sort_order, 0),
    p_detail_field
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_lead_source(
  p_id UUID,
  p_code TEXT,
  p_label_zh TEXT,
  p_default_referrer_id UUID,
  p_sort_order INT,
  p_is_active BOOLEAN,
  p_detail_field TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._lead_source_authorize();
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION '代號必填';
  END IF;
  IF p_label_zh IS NULL OR length(trim(p_label_zh)) = 0 THEN
    RAISE EXCEPTION '中文名稱必填';
  END IF;
  IF p_detail_field NOT IN ('none', 'internal_user', 'referrer') THEN
    RAISE EXCEPTION '無效的詳情欄位類型: %', p_detail_field;
  END IF;
  IF p_detail_field <> 'referrer' AND p_default_referrer_id IS NOT NULL THEN
    RAISE EXCEPTION '只有「轉介人」類型才能設定預設轉介人';
  END IF;

  UPDATE public.lead_sources SET
    code = trim(p_code),
    label_zh = trim(p_label_zh),
    default_referrer_id = p_default_referrer_id,
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = COALESCE(p_is_active, is_active),
    detail_field = p_detail_field
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '名單來源不存在';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lead_source(TEXT, TEXT, UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_source(UUID, TEXT, TEXT, UUID, INT, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
