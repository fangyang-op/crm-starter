-- ============================================================================
-- 0042 — UAT (測試回報專區) tables + RLS (uat-portal §2)
-- ============================================================================
--
-- 三張表分工:
--   uat_chapters  — 章節定義(seed-only,使用者不能 CUD)
--   uat_items     — 測試項目定義(seed-only)
--   uat_results   — 使用者回填結果(每人每項一筆,可修改)
--
-- 權限設計:
--   * 章節 / 項目定義 → 所有登入者可讀,無寫入 policy(只能 admin 透過
--     migration 或直接 SQL 增改)。
--   * 結果 → 使用者只能 SELECT/INSERT/UPDATE/DELETE 自己的(by user_id =
--     auth.uid())。Admin 額外有 SELECT-all policy 以便 §5 總覽頁面。
--
-- Storage bucket `uat-screenshots` 需在 Supabase Dashboard → Storage 手動
-- 建立(SQL 無法穩定建 bucket policy)。policy 建議:
--   * INSERT  — auth.uid() IS NOT NULL,且 path 第一段 = auth.uid()::text
--   * SELECT  — 同上,或 caller 為 admin
-- ============================================================================

CREATE TABLE public.uat_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INT NOT NULL DEFAULT 0,
  title_zh TEXT NOT NULL,
  icon TEXT NOT NULL,                      -- lucide icon 名稱
  description TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}', -- 空陣列 = 所有角色
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uat_chapters_sort_order ON public.uat_chapters(sort_order);

CREATE TABLE public.uat_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.uat_chapters(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  item_code TEXT UNIQUE NOT NULL,          -- e.g. '1-01', '2-03'
  step_description TEXT NOT NULL,
  expected_result TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uat_items_chapter ON public.uat_items(chapter_id, sort_order);

CREATE TABLE public.uat_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.uat_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  note TEXT,
  screenshot_path TEXT,                    -- Supabase Storage path(選填)
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)                -- 每人每項只有一筆
);

CREATE INDEX idx_uat_results_user ON public.uat_results(user_id);
CREATE INDEX idx_uat_results_item ON public.uat_results(item_id);

-- updated_at trigger,沿用 0001 內 fn_set_updated_at()。
CREATE TRIGGER trg_uat_results_updated_at
  BEFORE UPDATE ON public.uat_results
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.uat_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uat_results ENABLE ROW LEVEL SECURITY;

-- 章節 / 項目定義 — 所有登入者可讀。寫入只能透過 service role / SQL。
CREATE POLICY "uat_chapters_read"
  ON public.uat_chapters FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "uat_items_read"
  ON public.uat_items FOR SELECT TO authenticated
  USING (TRUE);

-- 結果 — 使用者只能讀寫自己的。
CREATE POLICY "uat_results_own_select"
  ON public.uat_results FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "uat_results_own_insert"
  ON public.uat_results FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "uat_results_own_update"
  ON public.uat_results FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "uat_results_own_delete"
  ON public.uat_results FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admin 可讀全部結果(供 §5 總覽 + CSV 匯出)。複用既有的 is_admin()。
CREATE POLICY "uat_results_admin_read"
  ON public.uat_results FOR SELECT TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
