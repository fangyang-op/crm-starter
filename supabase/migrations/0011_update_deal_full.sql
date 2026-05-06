-- ============================================================================
-- 0011 — replace 0010 metadata-only update_deal with a full edit
-- ============================================================================
--
-- The metadata-only update_deal from 0010 was too limiting. This version
-- accepts the full deal payload (plan + addons + discount + splits) and
-- handles the cascade:
--   • final_amount recomputed from new plan + addons − discount
--   • deal_commission_splits: all rows for this deal deleted, then
--     reinserted with new percentages and recomputed amounts
--   • word_quota_ledger: an 'adjustment' row is appended for the delta
--     between OLD and NEW plan.included_word_quota and between OLD and
--     NEW extra_word_quota (so balances stay consistent for any
--     subsequent 'used' / 'addon' entries that were already on file)
--   • activity_log: 'deal_updated' with payload describing what changed
--
-- Permission: same as create_deal — manager+/admin or consultant of the
-- deal's student.
--
-- Notable: the new plan must currently be is_active = TRUE *unless* it is
-- the same plan that the deal already references (so editing other
-- fields on a deal that uses a now-deactivated plan keeps working).
--
-- Word quota deltas use 'adjustment' (per docs/08 §2.2 — manager-driven
-- catch-all transaction) rather than synthetic 'refund' + 'initial' pairs;
-- the description marks them as deal-edit related and `related_deal_id`
-- ties them to the deal for audit.
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_deal(UUID, DATE, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_deal(
  p_id UUID,
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_authorized BOOLEAN;
  v_student_id UUID;

  v_old_plan_id UUID;
  v_old_extra_word_quota INTEGER;
  v_old_plan_word_quota INTEGER;

  v_new_plan_price NUMERIC;
  v_new_plan_currency TEXT;
  v_new_plan_word_quota INTEGER;

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

  v_balance INTEGER;
  v_delta_initial INTEGER;
  v_delta_addon INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION '找不到 profile' USING ERRCODE = '42501';
  END IF;

  -- Load existing deal
  SELECT student_id, plan_id, extra_word_quota
    INTO v_student_id, v_old_plan_id, v_old_extra_word_quota
  FROM public.deals WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '成交不存在';
  END IF;

  IF v_role IN ('manager_frontend', 'manager_backend', 'admin') THEN
    v_authorized := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.students
      WHERE id = v_student_id
        AND deleted_at IS NULL
        AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限編輯此成交' USING ERRCODE = '42501';
  END IF;

  -- Old plan's included_word_quota (might be null if plan was deleted, treat as 0)
  SELECT included_word_quota INTO v_old_plan_word_quota
  FROM public.service_plans WHERE id = v_old_plan_id;
  v_old_plan_word_quota := COALESCE(v_old_plan_word_quota, 0);

  -- New plan info — must be active OR the same plan the deal already uses
  SELECT base_price, currency, included_word_quota
    INTO v_new_plan_price, v_new_plan_currency, v_new_plan_word_quota
  FROM public.service_plans
  WHERE id = p_plan_id AND (is_active = TRUE OR id = v_old_plan_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION '方案不存在或已停用';
  END IF;
  v_new_plan_word_quota := COALESCE(v_new_plan_word_quota, 0);

  -- Addon prices
  SELECT unit_price INTO v_extra_school_price
  FROM public.addon_pricing WHERE type = 'extra_school' AND is_active;
  v_extra_school_price := COALESCE(v_extra_school_price, 0);

  SELECT unit_price INTO v_extra_word_price
  FROM public.addon_pricing WHERE type = 'extra_word_per_1000' AND is_active;
  v_extra_word_price := COALESCE(v_extra_word_price, 0);

  v_addon := COALESCE(p_extra_school_count, 0) * v_extra_school_price
           + (COALESCE(p_extra_word_quota, 0)::NUMERIC / 1000.0) * v_extra_word_price;
  v_final := v_new_plan_price + v_addon - COALESCE(p_discount_amount, 0);
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

  -- Update deal row
  UPDATE public.deals SET
    plan_id = p_plan_id,
    extra_school_count = COALESCE(p_extra_school_count, 0),
    extra_word_quota = COALESCE(p_extra_word_quota, 0),
    base_amount = v_new_plan_price,
    addon_amount = v_addon,
    discount_amount = COALESCE(p_discount_amount, 0),
    final_amount = v_final,
    currency = v_new_plan_currency,
    discount_reason = NULLIF(trim(coalesce(p_discount_reason, '')), ''),
    signed_at = p_signed_at,
    contract_no = NULLIF(trim(coalesce(p_contract_no, '')), ''),
    payment_status = coalesce(NULLIF(trim(p_payment_status), ''), 'pending'),
    notes = NULLIF(trim(coalesce(p_notes, '')), '')
  WHERE id = p_id;

  -- Replace splits wholesale
  DELETE FROM public.deal_commission_splits WHERE deal_id = p_id;

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
      p_id, v_user_id, v_referrer_id,
      v_role_in_deal, v_pct, round(v_final * v_pct / 100),
      NULLIF(trim(coalesce(v_split->>'notes', '')), '')
    );
  END LOOP;

  -- Word quota ledger deltas
  v_delta_initial := v_new_plan_word_quota - v_old_plan_word_quota;
  v_delta_addon := COALESCE(p_extra_word_quota, 0) - COALESCE(v_old_extra_word_quota, 0);

  IF v_delta_initial <> 0 OR v_delta_addon <> 0 THEN
    SELECT COALESCE(balance_after, 0) INTO v_balance
    FROM public.word_quota_ledger
    WHERE student_id = v_student_id
    ORDER BY created_at DESC
    LIMIT 1;
    v_balance := COALESCE(v_balance, 0);

    IF v_delta_initial <> 0 THEN
      v_balance := v_balance + v_delta_initial;
      INSERT INTO public.word_quota_ledger (
        student_id, transaction_type, amount, balance_after,
        description, related_deal_id, created_by
      ) VALUES (
        v_student_id, 'adjustment', v_delta_initial, v_balance,
        '成交修改:方案內含字數調整', p_id, auth.uid()
      );
    END IF;

    IF v_delta_addon <> 0 THEN
      v_balance := v_balance + v_delta_addon;
      INSERT INTO public.word_quota_ledger (
        student_id, transaction_type, amount, balance_after,
        description, related_deal_id, created_by
      ) VALUES (
        v_student_id, 'adjustment', v_delta_addon, v_balance,
        '成交修改:加購字數調整', p_id, auth.uid()
      );
    END IF;
  END IF;

  -- Activity log
  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'deal_updated', 'deal', p_id,
    jsonb_build_object(
      'final_amount', v_final,
      'currency', v_new_plan_currency,
      'split_count', v_split_count,
      'plan_changed', v_old_plan_id IS DISTINCT FROM p_plan_id,
      'word_delta', v_delta_initial + v_delta_addon
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_deal(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_deal(
  UUID, UUID, INTEGER, INTEGER, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, jsonb
) TO authenticated;

NOTIFY pgrst, 'reload schema';
