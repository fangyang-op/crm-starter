-- 0047 — Perf Tier 1: hot-query indexes
--
-- ⚠️ 待 Marcus 在 Supabase 手動套用(GitHub → Supabase 不自動)。
--
-- 這些索引針對 baseline 找到的熱查詢排序/篩選欄位(docs/perf/baseline.md §5)。
-- 全部 CREATE INDEX **CONCURRENTLY**:在有資料的正式表上不鎖寫入。
-- ⚠️ CONCURRENTLY 不能在 transaction block 內執行 —— 在 Supabase SQL Editor
-- 請「一條一條」貼上執行(或用支援 no-transaction 的 migration 流程),不要整檔
-- 包在 BEGIN/COMMIT 內。每條都 IF NOT EXISTS,可安全重跑。
-- 套用後建議 `ANALYZE public.students;`（及其他受影響表)更新統計。

-- 1) 學生列表預設排序 `ORDER BY created_at`(永遠帶 deleted_at IS NULL)。
--    目前 students 無 created_at 索引 → 大表每頁載入都做一次過濾後排序。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_created_at_active
  ON public.students (created_at DESC)
  WHERE deleted_at IS NULL;

-- 2) 列表狀態篩選 `.eq/.in(status_id)`(永遠帶 deleted_at IS NULL)。
--    現有 idx_students_status_id 非 partial,無法對齊「永遠 deleted_at IS NULL」
--    的查詢形狀;補一條 partial。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_status_id_active
  ON public.students (status_id)
  WHERE deleted_at IS NULL;

-- 3) 儀表板「未派後端」計數 + /students?backend=unassigned:
--    deleted_at IS NULL AND backend_consultant_id IS NULL AND status_id IN (...)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_unassigned_backend
  ON public.students (status_id)
  WHERE deleted_at IS NULL AND backend_consultant_id IS NULL;

-- 4) 學校列表排序 `ORDER BY country, ranking_qs, name_en`。
--    現有 idx_schools_country 只蓋第一個鍵;補一條複合索引蓋完整排序。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schools_country_qs_name
  ON public.schools (country, ranking_qs, name_en);

-- 5) 學生詳細頁 — 文件 master 的 variant/version 排序輔助 + 院系排序。
--    (學生詳細頁的 tab 延後渲染留待後續 PR;這兩條索引先備好。)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_school_programs_school_degree
  ON public.school_programs (school_id, degree_level, program_name);

-- 6) layout UAT badge:每次導航查 active 章節/項目。表小,效益有限,低優先。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uat_chapters_active
  ON public.uat_chapters (is_active)
  WHERE is_active;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uat_items_active
  ON public.uat_items (is_active)
  WHERE is_active;

-- 後續(本輪未做,Tier 1 可選 / Tier 3):
--   ILIKE 文字搜尋(students.full_name/english_name/email、schools.name_*)需
--   pg_trgm GIN 才走索引:
--     CREATE EXTENSION IF NOT EXISTS pg_trgm;
--     CREATE INDEX CONCURRENTLY idx_students_fullname_trgm
--       ON public.students USING gin (full_name gin_trgm_ops) WHERE deleted_at IS NULL;
--   評估後再決定(寫入成本 vs 搜尋頻率)。
