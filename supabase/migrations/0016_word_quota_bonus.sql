-- ============================================================================
-- 0016 — add_word_quota_bonus via SECURITY DEFINER (Phase 3.4)
-- ============================================================================
--
-- Per roadmap: 「僅 manager+ 或 frontend consultant」可加碼字數。注意這刻意
-- 排除 backend consultant — 後端是執行端,加碼是業務端的決策。
--
-- Permission rule:
--   - manager_frontend / manager_backend / admin: any student
--   - consultant: ONLY if frontend_consultant_id = auth.uid() of the
--     target student (NOT backend_consultant_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_word_quota_bonus(
  p_student_id UUID,
  p_amount INTEGER,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
  v_balance INTEGER;
  v_id UUID;
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
    -- Strict: only frontend consultant of THIS student (backend consultant
    -- intentionally excluded per roadmap).
    SELECT EXISTS (
      SELECT 1 FROM public.students
      WHERE id = p_student_id
        AND deleted_at IS NULL
        AND frontend_consultant_id = auth.uid()
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限為此學生加碼字數(僅 manager+ 或前端顧問)'
      USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '加碼數量必須 > 0';
  END IF;
  IF p_amount > 1000000 THEN
    RAISE EXCEPTION '加碼數量太大(>1M),請確認';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION '請填寫加碼原因';
  END IF;

  -- Verify student exists & not soft-deleted
  PERFORM 1 FROM public.students
  WHERE id = p_student_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION '學生不存在或已刪除';
  END IF;

  -- Get latest balance (carry forward)
  SELECT COALESCE(balance_after, 0) INTO v_balance
  FROM public.word_quota_ledger
  WHERE student_id = p_student_id
  ORDER BY created_at DESC
  LIMIT 1;
  v_balance := COALESCE(v_balance, 0);

  INSERT INTO public.word_quota_ledger (
    student_id, transaction_type, amount, balance_after,
    description, created_by
  ) VALUES (
    p_student_id, 'bonus', p_amount, v_balance + p_amount,
    trim(p_description), auth.uid()
  )
  RETURNING id INTO v_id;

  -- Optional activity_log entry — useful in timeline; "quota_bonus"
  -- isn't in the formatter map yet but the description fallback handles it.
  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(), 'quota_bonus', 'word_quota_ledger', v_id,
    jsonb_build_object('amount', p_amount, 'description', trim(p_description))
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_word_quota_bonus(UUID, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
