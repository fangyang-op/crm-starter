-- ============================================================================
-- 0036 — Add 兵役證明 (military_service_record) to document_templates
-- ============================================================================
--
-- v1.2 §3: a 14th template under category 'visa_enrollment'. Unlike the
-- Appendix A seed (which defaults default_required = TRUE per the column
-- default), this one is opt-in — back-end consultants tick it only for
-- students whose target country needs proof of military service.
--
-- sort_order 150 places it after the 4 existing visa_enrollment items
-- (110–140). Idempotent on re-run via ON CONFLICT (code).
-- ============================================================================

INSERT INTO public.document_templates (
  code, label_zh, category, description, notes,
  default_required, sort_order, is_active
) VALUES (
  'military_service_record',
  '兵役證明',
  'visa_enrollment',
  '用於證明學生兵役狀態,部分國家簽證申請或學校入學程序需要提供。',
  '請至戶政事務所或區公所申請「兵役狀況證明書」(英文版)。役畢者請附退伍令影本;免役者請附免役證明;在學緩徵者請附緩徵證明。所有文件需為彩色掃描或照片。',
  FALSE,
  150,
  TRUE
)
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
