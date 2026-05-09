-- ============================================================================
-- 0044 — Drop students_phone_unique (duplicate-prevention §2A 修正)
-- ============================================================================
--
-- 0037 加的 students_phone_unique 與 §2A 的「確認為不同學生,繼續建立」
-- 流程衝突:即便顧問在前端確認 override,DB 仍會以 23505 unique_violation
-- 擋住 INSERT。
--
-- 規格本來就允許重複(只要顧問確認),DB 不應該硬擋。改成由 app-level
-- checkPhoneDuplicate() 偵測 + duplicateOverride 旗標跳過,並透過
-- activity_log(duplicate_phone_override)讓 §4 主管 widget 仍可審查。
-- ============================================================================

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_phone_unique;

NOTIFY pgrst, 'reload schema';
