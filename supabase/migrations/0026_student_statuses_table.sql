-- ============================================================================
-- 0026 — Convert student_status enum → student_statuses table
-- ============================================================================
--
-- Spec § 1.3: admins must be able to add / rename / reorder / deactivate
-- student status entries. The current enum is fixed at migration time.
-- This migration follows the same shape as 0022 (lead_sources) but is
-- larger because student_status is also referenced by:
--   * students.status                              (column)
--   * student_status_history.from_status / to_status (columns)
--   * change_student_status(...)                   (SD function signature)
--   * fn_log_status_change()                       (trigger function body)
--
-- Migration steps:
--   1. Create student_statuses + seed all 16 historical values.
--   2. Add students.status_id (UUID FK, nullable initially), backfill, NOT NULL.
--   3. Add student_status_history.from_status_id / to_status_id, backfill.
--   4. DROP the change_student_status enum-signature function (we recreate
--      with UUID signature below).
--   5. DROP students.status, student_status_history.from_status / to_status.
--   6. DROP TYPE student_status.
--   7. Replace fn_log_status_change to write the new FK columns.
--   8. Recreate change_student_status with UUID signature; transition rules
--      are now permissive (any -> any) per spec MVP decision.
--   9. SD CRUD for student_statuses (admin only).
--
-- After this migration, lib/constants/student-status.ts becomes a fallback
-- only — labels / colors are read from the table at runtime.
-- ============================================================================

-- 1. student_statuses table -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label_zh TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('recruitment', 'closed', 'application', 'special')),
  -- color_key resolves to a tailwind class string in the UI. See
  -- lib/constants/student-status.ts COLOR_PRESETS for the mapping.
  color_key TEXT NOT NULL DEFAULT 'slate',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 16 historical enum values (idempotent on re-run).
INSERT INTO public.student_statuses (code, label_zh, category, color_key, sort_order)
SELECT * FROM (VALUES
  ('new_lead', '新名單', 'recruitment', 'slate', 10),
  ('contacted', '聯繫中', 'recruitment', 'blue', 20),
  ('consulting', '諮詢中', 'recruitment', 'cyan', 30),
  ('qualified', '意向客戶', 'recruitment', 'violet', 40),
  ('disqualified', '無效名單', 'recruitment', 'gray', 50),
  ('closed_won', '已成交', 'closed', 'emerald', 60),
  ('onboarding', '資料準備', 'application', 'teal', 70),
  ('school_selection', '選校規劃', 'application', 'indigo', 80),
  ('document_prep', '書審準備', 'application', 'purple', 90),
  ('submitting', '申請送出', 'application', 'fuchsia', 100),
  ('awaiting_decision', '等待結果', 'application', 'amber', 110),
  ('decision_making', '錄取確認', 'application', 'orange', 120),
  ('pre_departure', '入學準備', 'application', 'lime', 130),
  ('enrolled', '已入學', 'application', 'green', 140),
  ('paused', '暫緩', 'special', 'yellow', 150),
  ('terminated', '退費終止', 'special', 'red', 160)
) AS v(code, label_zh, category, color_key, sort_order)
ON CONFLICT (code) DO NOTHING;

DROP TRIGGER IF EXISTS trg_student_statuses_updated_at ON public.student_statuses;
CREATE TRIGGER trg_student_statuses_updated_at
  BEFORE UPDATE ON public.student_statuses
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.student_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_statuses_select ON public.student_statuses;
CREATE POLICY student_statuses_select ON public.student_statuses
  FOR SELECT TO authenticated USING (TRUE);

-- 2. students.status_id (FK) ------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.student_statuses(id);

-- Backfill from existing enum column (safe to re-run; only fills missing rows)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'status'
  ) THEN
    UPDATE public.students s
    SET status_id = ss.id
    FROM public.student_statuses ss
    WHERE s.status_id IS NULL AND ss.code = s.status::text;
  END IF;
END $$;

ALTER TABLE public.students ALTER COLUMN status_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_status_id ON public.students(status_id);

-- 3. student_status_history.from_status_id / to_status_id -------------------
ALTER TABLE public.student_status_history
  ADD COLUMN IF NOT EXISTS from_status_id UUID REFERENCES public.student_statuses(id),
  ADD COLUMN IF NOT EXISTS to_status_id UUID REFERENCES public.student_statuses(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_status_history'
      AND column_name = 'from_status'
  ) THEN
    UPDATE public.student_status_history h
    SET from_status_id = (SELECT id FROM public.student_statuses WHERE code = h.from_status::text)
    WHERE h.from_status IS NOT NULL AND h.from_status_id IS NULL;

    UPDATE public.student_status_history h
    SET to_status_id = (SELECT id FROM public.student_statuses WHERE code = h.to_status::text)
    WHERE h.to_status_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.student_status_history ALTER COLUMN to_status_id SET NOT NULL;

-- 4. Drop the enum-signature SD function ------------------------------------
DROP FUNCTION IF EXISTS public.change_student_status(UUID, student_status, TEXT);

-- 5. Drop old enum columns --------------------------------------------------
-- Drop the trigger first; we recreate it after the column types change.
DROP TRIGGER IF EXISTS trg_students_status_history ON public.students;

ALTER TABLE public.students DROP COLUMN IF EXISTS status;
ALTER TABLE public.student_status_history DROP COLUMN IF EXISTS from_status;
ALTER TABLE public.student_status_history DROP COLUMN IF EXISTS to_status;

-- 6. Drop the enum type -----------------------------------------------------
DROP TYPE IF EXISTS public.student_status;

-- 7. Replace fn_log_status_change to use the FK columns ---------------------
CREATE OR REPLACE FUNCTION public.fn_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO student_status_history (student_id, from_status_id, to_status_id, changed_by)
    VALUES (NEW.id, NULL, NEW.status_id, NEW.created_by);
  ELSIF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    INSERT INTO student_status_history (student_id, from_status_id, to_status_id, changed_by)
    VALUES (NEW.id, OLD.status_id, NEW.status_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_students_status_history
  AFTER INSERT OR UPDATE OF status_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_status_change();

-- 8. Recreate change_student_status with UUID signature ---------------------
-- Spec § 2.2 says MVP allows any → any (admin owns the whitelist now).
-- We still write history + activity_log on every change.
CREATE OR REPLACE FUNCTION public.change_student_status(
  p_id UUID,
  p_new_status_id UUID,
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
  v_old_status_id UUID;
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

  SELECT status_id INTO v_old_status_id
  FROM public.students
  WHERE id = p_id AND deleted_at IS NULL;
  IF v_old_status_id IS NULL THEN
    RAISE EXCEPTION '學生不存在或已刪除';
  END IF;
  IF v_old_status_id = p_new_status_id THEN
    RAISE EXCEPTION '狀態未變更';
  END IF;
  PERFORM 1 FROM public.student_statuses WHERE id = p_new_status_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到目標狀態';
  END IF;

  -- Update. trg_students_status_history fires AFTER UPDATE OF status_id and
  -- writes a row to student_status_history (with note = NULL).
  UPDATE public.students SET status_id = p_new_status_id WHERE id = p_id;

  IF p_note IS NOT NULL AND p_note <> '' THEN
    UPDATE public.student_status_history
    SET note = p_note
    WHERE id = (
      SELECT id FROM public.student_status_history
      WHERE student_id = p_id
        AND from_status_id IS NOT DISTINCT FROM v_old_status_id
        AND to_status_id = p_new_status_id
      ORDER BY changed_at DESC
      LIMIT 1
    );
  END IF;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_id, auth.uid(), 'status_changed', 'student', p_id,
    jsonb_build_object(
      'from_status_id', v_old_status_id,
      'to_status_id', p_new_status_id,
      'note', p_note
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_student_status(UUID, UUID, TEXT) TO authenticated;

-- 9. Admin-only CRUD for student_statuses -----------------------------------
CREATE OR REPLACE FUNCTION public._student_status_authorize()
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
    RAISE EXCEPTION '只有 Admin 可維護學生狀態' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._student_status_authorize() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_student_status(
  p_code TEXT,
  p_label_zh TEXT,
  p_category TEXT,
  p_color_key TEXT,
  p_sort_order INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM public._student_status_authorize();
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION '代號必填';
  END IF;
  IF p_label_zh IS NULL OR length(trim(p_label_zh)) = 0 THEN
    RAISE EXCEPTION '中文名稱必填';
  END IF;
  IF p_category NOT IN ('recruitment', 'closed', 'application', 'special') THEN
    RAISE EXCEPTION '無效的分類: %', p_category;
  END IF;

  INSERT INTO public.student_statuses (
    code, label_zh, category, color_key, sort_order
  ) VALUES (
    trim(p_code),
    trim(p_label_zh),
    p_category,
    coalesce(NULLIF(trim(coalesce(p_color_key, '')), ''), 'slate'),
    COALESCE(p_sort_order, 0)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_student_status(
  p_id UUID,
  p_code TEXT,
  p_label_zh TEXT,
  p_category TEXT,
  p_color_key TEXT,
  p_sort_order INT,
  p_is_active BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._student_status_authorize();
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION '代號必填';
  END IF;
  IF p_label_zh IS NULL OR length(trim(p_label_zh)) = 0 THEN
    RAISE EXCEPTION '中文名稱必填';
  END IF;
  IF p_category NOT IN ('recruitment', 'closed', 'application', 'special') THEN
    RAISE EXCEPTION '無效的分類: %', p_category;
  END IF;

  UPDATE public.student_statuses SET
    code = trim(p_code),
    label_zh = trim(p_label_zh),
    category = p_category,
    color_key = coalesce(NULLIF(trim(coalesce(p_color_key, '')), ''), color_key),
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '學生狀態不存在';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_student_status(TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_status(UUID, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
