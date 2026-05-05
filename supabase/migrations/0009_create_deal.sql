-- ============================================================================
-- 0009 — create_deal SECURITY DEFINER (Phase 1.7 + 1.8)
-- ============================================================================
--
-- One atomic operation:
--   1. permission check (manager+/admin OR consultant of this student)
--   2. read plan + addon unit prices from DB
--   3. compute base / addon / final amounts (server-authoritative — UI only
--      shows preview; this function is the source of truth)
--   4. insert deals row
--   5. iterate p_splits jsonb, validate primary+referrer total = 100, insert
--      deal_commission_splits with each split's amount = final * pct / 100
--   6. insert word_quota_ledger entries:
--        - 'initial'  = plan.included_word_quota
--        - 'addon'    = p_extra_word_quota (skip if 0)
--      balance_after carries forward from any prior ledger rows (so a second
--      deal on the same student adds, not resets).
--   7. transition students.status to 'closed_won' if currently in
--      {new_lead, contacted, consulting, qualified}; trigger writes
--      status_history automatically.
--   8. insert activity_log 'deal_created' with payload.final_amount.
--
-- p_splits format:
--   [{
--     "role_in_deal": "primary_consultant" | "referrer" | "manager_bonus",
--     "recipient_user_id": "<uuid>" | null,
--     "recipient_referrer_id": "<uuid>" | null,  (exactly one of the two)
--     "percentage": 65,
--     "notes": "..." | null
--   }, ...]
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_deal(
  p_student_id UUID,
  p_plan_id UUID,
  p_extra_school_count INTEGER,
  p_extra_word_quota INTEGER,
  p_discount_amount NUMERIC,
  p_discount_reason TEXT,
  p_signed_at DATE,
  p_contract_no TEXT,
  p_payment_status TEXT,
  p_notes TEXT,
  p_splits jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
  v_student_status student_status;

  v_plan_price NUMERIC;
  v_plan_currency TEXT;
  v_plan_word_quota INTEGER;

  v_extra_school_price NUMERIC;
  v_extra_word_price NUMERIC;

  v_addon NUMERIC;
  v_final NUMERIC;

  v_split jsonb;
  v_role_in_deal TEXT;
  v_user_id UUID;
  v_referrer_id UUID;
  v_pct NUMERIC;
  v_main_total NUMERIC := 0;
  v_split_count INTEGER := 0;

  v_deal_id UUID;
  v_balance INTEGER;
  v_quota_added INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION '找不到 profile' USING ERRCODE = '42501';
  END IF;

  -- Permission: manager+/admin or consultant of this student
  IF v_role IN ('manager_frontend', 'manager_backend', 'admin') THEN
    v_authorized := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.students
      WHERE id = p_student_id
        AND deleted_at IS NULL
        AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限為此學生建立成交' USING ERRCODE = '42501';
  END IF;

  -- Verify student exists and not deleted; capture current status
  SELECT status INTO v_student_status
  FROM public.students
  WHERE id = p_student_id AND deleted_at IS NULL;
  IF v_student_status IS NULL THEN
    RAISE EXCEPTION '學生不存在或已刪除';
  END IF;

  -- Resolve plan
  SELECT base_price, currency, included_word_quota
    INTO v_plan_price, v_plan_currency, v_plan_word_quota
  FROM public.service_plans
  WHERE id = p_plan_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '方案不存在或已停用';
  END IF;

  -- Resolve addon unit prices (default 0 if not configured)
  SELECT unit_price INTO v_extra_school_price
  FROM public.addon_pricing WHERE type = 'extra_school' AND is_active;
  v_extra_school_price := COALESCE(v_extra_school_price, 0);

  SELECT unit_price INTO v_extra_word_price
  FROM public.addon_pricing WHERE type = 'extra_word_per_1000' AND is_active;
  v_extra_word_price := COALESCE(v_extra_word_price, 0);

  -- Compute amounts
  v_addon := COALESCE(p_extra_school_count, 0) * v_extra_school_price
           + (COALESCE(p_extra_word_quota, 0)::NUMERIC / 1000.0) * v_extra_word_price;
  v_final := v_plan_price + v_addon - COALESCE(p_discount_amount, 0);

  IF v_final < 0 THEN
    RAISE EXCEPTION '最終金額不能為負數(計算後 = %)', v_final;
  END IF;

  -- Validate splits
  IF jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION '至少要有一筆拆分';
  END IF;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_role_in_deal := v_split->>'role_in_deal';
    v_user_id := NULLIF(v_split->>'recipient_user_id', '')::UUID;
    v_referrer_id := NULLIF(v_split->>'recipient_referrer_id', '')::UUID;
    v_pct := (v_split->>'percentage')::NUMERIC;

    IF v_role_in_deal NOT IN ('primary_consultant', 'referrer', 'manager_bonus') THEN
      RAISE EXCEPTION '無效的拆分角色: %', v_role_in_deal;
    END IF;

    IF (v_user_id IS NULL) = (v_referrer_id IS NULL) THEN
      RAISE EXCEPTION '拆分必須二擇一指定 user 或 referrer';
    END IF;

    IF v_pct IS NULL OR v_pct < 0 THEN
      RAISE EXCEPTION '拆分比例必須 >= 0';
    END IF;

    IF v_role_in_deal IN ('primary_consultant', 'referrer') THEN
      v_main_total := v_main_total + v_pct;
    END IF;

    v_split_count := v_split_count + 1;
  END LOOP;

  IF abs(v_main_total - 100) > 0.01 THEN
    RAISE EXCEPTION '主拆分總和必須等於 100%%(目前 = %)', v_main_total;
  END IF;

  -- Insert the deal
  INSERT INTO public.deals (
    student_id, plan_id,
    extra_school_count, extra_word_quota,
    base_amount, addon_amount, discount_amount, final_amount, currency,
    discount_reason, signed_at, contract_no, payment_status, notes, created_by
  ) VALUES (
    p_student_id, p_plan_id,
    COALESCE(p_extra_school_count, 0), COALESCE(p_extra_word_quota, 0),
    v_plan_price, v_addon, COALESCE(p_discount_amount, 0), v_final, v_plan_currency,
    NULLIF(trim(coalesce(p_discount_reason, '')), ''),
    p_signed_at,
    NULLIF(trim(coalesce(p_contract_no, '')), ''),
    coalesce(NULLIF(trim(p_payment_status), ''), 'pending'),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_deal_id;

  -- Insert splits with computed amount
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_role_in_deal := v_split->>'role_in_deal';
    v_user_id := NULLIF(v_split->>'recipient_user_id', '')::UUID;
    v_referrer_id := NULLIF(v_split->>'recipient_referrer_id', '')::UUID;
    v_pct := (v_split->>'percentage')::NUMERIC;

    INSERT INTO public.deal_commission_splits (
      deal_id, recipient_user_id, recipient_referrer_id,
      role_in_deal, percentage, amount, notes
    ) VALUES (
      v_deal_id, v_user_id, v_referrer_id,
      v_role_in_deal, v_pct, round(v_final * v_pct / 100),
      NULLIF(trim(coalesce(v_split->>'notes', '')), '')
    );
  END LOOP;

  -- Word quota ledger: initial from plan, addon if any
  SELECT COALESCE(balance_after, 0) INTO v_balance
  FROM public.word_quota_ledger
  WHERE student_id = p_student_id
  ORDER BY created_at DESC
  LIMIT 1;
  v_balance := COALESCE(v_balance, 0);

  IF COALESCE(v_plan_word_quota, 0) > 0 THEN
    v_quota_added := v_plan_word_quota;
    v_balance := v_balance + v_quota_added;
    INSERT INTO public.word_quota_ledger (
      student_id, transaction_type, amount, balance_after,
      description, related_deal_id, created_by
    ) VALUES (
      p_student_id, 'initial', v_quota_added, v_balance,
      '方案內含字數', v_deal_id, auth.uid()
    );
  END IF;

  IF COALESCE(p_extra_word_quota, 0) > 0 THEN
    v_quota_added := p_extra_word_quota;
    v_balance := v_balance + v_quota_added;
    INSERT INTO public.word_quota_ledger (
      student_id, transaction_type, amount, balance_after,
      description, related_deal_id, created_by
    ) VALUES (
      p_student_id, 'addon', v_quota_added, v_balance,
      '加購字數', v_deal_id, auth.uid()
    );
  END IF;

  -- Auto-transition status if currently in pre-closed_won states.
  -- The trg_students_status_history trigger will write a history row.
  IF v_student_status IN ('new_lead', 'contacted', 'consulting', 'qualified') THEN
    UPDATE public.students SET status = 'closed_won' WHERE id = p_student_id;
  END IF;

  -- Activity log
  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    p_student_id, auth.uid(), 'deal_created', 'deal', v_deal_id,
    jsonb_build_object(
      'final_amount', v_final,
      'currency', v_plan_currency,
      'split_count', v_split_count
    )
  );

  RETURN v_deal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_deal(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_deal(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, jsonb
) TO authenticated;
