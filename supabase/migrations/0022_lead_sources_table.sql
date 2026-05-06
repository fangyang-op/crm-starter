-- ============================================================================
-- 0022 — Convert lead_source_type enum → lead_sources table
-- ============================================================================
--
-- Spec § 1.1: admins must be able to add / edit / soft-delete lead sources
-- and link them to default referrers. The current `lead_source_type` enum
-- is fixed at migration time, so we replace it with a relation table.
--
-- Migration steps (each idempotent enough that re-running on a half-applied
-- DB only re-creates / reseeds, except the destructive DROP TYPE — that's
-- guarded with IF EXISTS):
--
-- 1. Create `lead_sources` table + seed with the 6 existing enum values.
--    The `code` column preserves the old enum value so any out-of-band
--    references (logs, payloads) still resolve.
-- 2. Add `referrers.default_split_percent` and a `lead_source_referrers`
--    join table for the future M:N case (UI only uses default_referrer_id
--    in this commit).
-- 3. Add `students.lead_source_id`, backfill from the enum column, then
--    flip to NOT NULL.
-- 4. Drop `students.lead_source_type` and the `lead_source_type` enum type.
-- 5. Replace `update_student` (from 0007) so it writes `lead_source_id`
--    instead of the dropped enum column. The handover / activity-log
--    block is unchanged.
-- 6. SD CRUD for lead_sources, gated by admin only.
-- ============================================================================

-- 1. lead_sources table -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label_zh TEXT NOT NULL,
  default_referrer_id UUID REFERENCES public.referrers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed only if the table is empty (idempotent re-runs)
INSERT INTO public.lead_sources (code, label_zh, sort_order)
SELECT * FROM (VALUES
  ('self_developed', '自行開發', 10),
  ('marketing_dept', '行銷部分配', 20),
  ('consultant_referral', '同事轉介', 30),
  ('external_referrer', '外部轉介人', 40),
  ('brand_introduction', '品牌介紹', 50),
  ('other', '其他', 99)
) AS v(code, label_zh, sort_order)
ON CONFLICT (code) DO NOTHING;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_lead_sources_updated_at ON public.lead_sources;
CREATE TRIGGER trg_lead_sources_updated_at
  BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_sources_select ON public.lead_sources;
CREATE POLICY lead_sources_select ON public.lead_sources
  FOR SELECT TO authenticated USING (TRUE);

-- 2. referrers extras -------------------------------------------------------
ALTER TABLE public.referrers
  ADD COLUMN IF NOT EXISTS default_split_percent NUMERIC(5, 2);

-- M:N join table (reserved for future, no UI yet)
CREATE TABLE IF NOT EXISTS public.lead_source_referrers (
  lead_source_id UUID NOT NULL REFERENCES public.lead_sources(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.referrers(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_source_id, referrer_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.lead_source_referrers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lsr_select ON public.lead_source_referrers;
CREATE POLICY lsr_select ON public.lead_source_referrers
  FOR SELECT TO authenticated USING (TRUE);

-- 3. students.lead_source_id (FK) -------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES public.lead_sources(id);

-- Backfill from the existing enum column (only rows still missing the FK).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'lead_source_type'
  ) THEN
    UPDATE public.students s
    SET lead_source_id = ls.id
    FROM public.lead_sources ls
    WHERE s.lead_source_id IS NULL
      AND ls.code = s.lead_source_type::text;
  END IF;
END $$;

-- After backfill, lock NOT NULL
ALTER TABLE public.students ALTER COLUMN lead_source_id SET NOT NULL;

-- 4. Drop the old enum column + type ----------------------------------------
ALTER TABLE public.students DROP COLUMN IF EXISTS lead_source_type;
DROP TYPE IF EXISTS public.lead_source_type;

-- 5. Replace update_student to use lead_source_id ---------------------------
-- This is a verbatim re-emit of 0007's update_student with the lead_source
-- block swapped out. Everything else (handover writes, activity log,
-- authorization) is identical.
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
    lead_source_id = COALESCE(
      NULLIF(p_data->>'lead_source_id', '')::UUID,
      lead_source_id
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

-- 6. Lead sources CRUD (admin only) -----------------------------------------
CREATE OR REPLACE FUNCTION public._lead_source_authorize()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION '只有 Admin 可維護名單來源' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._lead_source_authorize() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_lead_source(
  p_code TEXT,
  p_label_zh TEXT,
  p_default_referrer_id UUID,
  p_sort_order INT
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
  INSERT INTO public.lead_sources (code, label_zh, default_referrer_id, sort_order)
  VALUES (
    trim(p_code),
    trim(p_label_zh),
    p_default_referrer_id,
    COALESCE(p_sort_order, 0)
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
  p_is_active BOOLEAN
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
  UPDATE public.lead_sources SET
    code = trim(p_code),
    label_zh = trim(p_label_zh),
    default_referrer_id = p_default_referrer_id,
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '名單來源不存在';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lead_source(TEXT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_source(UUID, TEXT, TEXT, UUID, INT, BOOLEAN) TO authenticated;

-- 7. Extend referrer SD functions to accept default_split_percent ----------
-- Re-emit 0006's create_referrer / update_referrer with the extra param.
-- The old 5-arg signature still exists; we replace by adding a NEW
-- function that takes split_percent. Action layer is updated to call this
-- variant.
CREATE OR REPLACE FUNCTION public.create_referrer(
  p_name TEXT,
  p_type TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_default_split_percent NUMERIC,
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
  IF p_type NOT IN ('individual', 'organization', 'school', 'partner') THEN
    RAISE EXCEPTION '無效的轉介人類型: %', p_type;
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION '姓名必填';
  END IF;
  IF p_default_split_percent IS NOT NULL
     AND (p_default_split_percent < 0 OR p_default_split_percent > 100) THEN
    RAISE EXCEPTION '預設拆分比例必須介於 0 與 100 之間';
  END IF;

  INSERT INTO public.referrers (
    name, type, contact_email, contact_phone, default_split_percent, notes
  ) VALUES (
    trim(p_name),
    p_type,
    NULLIF(trim(coalesce(p_contact_email, '')), ''),
    NULLIF(trim(coalesce(p_contact_phone, '')), ''),
    p_default_split_percent,
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
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_default_split_percent NUMERIC,
  p_notes TEXT,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role;
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
  IF p_default_split_percent IS NOT NULL
     AND (p_default_split_percent < 0 OR p_default_split_percent > 100) THEN
    RAISE EXCEPTION '預設拆分比例必須介於 0 與 100 之間';
  END IF;

  UPDATE public.referrers
  SET
    name = trim(p_name),
    type = p_type,
    contact_email = NULLIF(trim(coalesce(p_contact_email, '')), ''),
    contact_phone = NULLIF(trim(coalesce(p_contact_phone, '')), ''),
    default_split_percent = p_default_split_percent,
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    is_active = p_is_active,
    updated_at = NOW()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到此轉介人';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_referrer(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_referrer(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
