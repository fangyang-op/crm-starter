-- ============================================================================
-- 0033 — Fix create_deal: drop the student_status enum reference
-- ============================================================================
--
-- 0009's create_deal still declared `v_student_status student_status` and
-- ran a status-based auto-transition to 'closed_won'. After 0026 dropped
-- the enum + the students.status column the function fails at parse time
-- with `type "student_status" does not exist`.
--
-- The auto-transition is now redundant: the action layer (deals/actions.ts)
-- calls change_student_status RPC after createDeal succeeds, which already
-- writes the history row + activity_log entry. So we drop that block here
-- and just verify the student exists + not deleted.
--
-- Body is otherwise a verbatim copy of 0009's create_deal so the rest of
-- the deal-creation logic (split validation, amount math, addon ledger
-- inserts, activity_log) is preserved.
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
  v_student_exists BOOLEAN;

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

  -- Verify student exists and not deleted (no longer reads .status — the
  -- column was dropped in 0026 in favour of status_id).
  SELECT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id AND deleted_at IS NULL
  ) INTO v_student_exists;
  IF NOT v_student_exists THEN
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
  IF p_extra_school_count IS NULL OR p_extra_school_count < 0 THEN
    RAISE EXCEPTION '加購學校數不可為負';
  END IF;
  IF p_extra_word_quota IS NULL OR p_extra_word_quota < 0 THEN
    RAISE EXCEPTION '加購字數不可為負';
  END IF;
  IF p_discount_amount IS NULL OR p_discount_amount < 0 THEN
    RAISE EXCEPTION '優惠金額不可為負';
  END IF;

  v_addon :=
    p_extra_school_count * v_extra_school_price
    + (p_extra_word_quota / 1000.0) * v_extra_word_price;
  v_final := v_plan_price + v_addon - p_discount_amount;
  IF v_final < 0 THEN
    RAISE EXCEPTION '優惠金額大於小計,最終金額不能為負';
  END IF;

  IF p_payment_status NOT IN ('pending', 'partial', 'paid') THEN
    RAISE EXCEPTION '無效的付款狀態: %', p_payment_status;
  END IF;
  IF p_signed_at IS NULL THEN
    RAISE EXCEPTION '簽約日必填';
  END IF;

  -- Validate splits early so we don't write a half-deal
  IF jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION '至少需要一筆主顧問拆分';
  END IF;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_role_in_deal := v_split->>'role_in_deal';
    v_user_id      := NULLIF(v_split->>'recipient_user_id', '')::UUID;
    v_referrer_id  := NULLIF(v_split->>'recipient_referrer_id', '')::UUID;
    v_pct          := (v_split->>'percentage')::NUMERIC;

    IF v_role_in_deal NOT IN ('primary_consultant', 'referrer', 'manager_bonus') THEN
      RAISE EXCEPTION '無效的拆分角色: %', v_role_in_deal;
    END IF;
    IF v_pct IS NULL OR v_pct < 0 OR v_pct > 100 THEN
      RAISE EXCEPTION '拆分百分比必須在 0..100 之間';
    END IF;
    IF v_user_id IS NULL AND v_referrer_id IS NULL THEN
      RAISE EXCEPTION '拆分需指定 user 或 referrer';
    END IF;
    IF v_user_id IS NOT NULL AND v_referrer_id IS NOT NULL THEN
      RAISE EXCEPTION '拆分不能同時指定 user 與 referrer';
    END IF;

    IF v_role_in_deal IN ('primary_consultant', 'referrer') THEN
      v_main_total := v_main_total + v_pct;
    END IF;

    v_split_count := v_split_count + 1;
  END LOOP;

  IF v_main_total <> 100 THEN
    RAISE EXCEPTION '主顧問 + 轉介人比例需合計 100,目前為 %', v_main_total;
  END IF;

  -- Insert deal
  INSERT INTO public.deals (
    student_id, plan_id,
    extra_school_count, extra_word_quota,
    base_amount, addon_amount, discount_amount, final_amount,
    currency,
    discount_reason, signed_at, contract_no, payment_status, notes,
    created_by
  ) VALUES (
    p_student_id, p_plan_id,
    p_extra_school_count, p_extra_word_quota,
    v_plan_price, v_addon, p_discount_amount, v_final,
    v_plan_currency,
    NULLIF(trim(coalesce(p_discount_reason, '')), ''),
    p_signed_at,
    NULLIF(trim(coalesce(p_contract_no, '')), ''),
    p_payment_status,
    NULLIF(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_deal_id;

  -- Insert deal_splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO public.deal_splits (
      deal_id, role_in_deal, recipient_user_id, recipient_referrer_id,
      percentage, notes
    ) VALUES (
      v_deal_id,
      v_split->>'role_in_deal',
      NULLIF(v_split->>'recipient_user_id', '')::UUID,
      NULLIF(v_split->>'recipient_referrer_id', '')::UUID,
      (v_split->>'percentage')::NUMERIC,
      NULLIF(trim(v_split->>'notes'), '')
    );
  END LOOP;

  -- word_quota_ledger seed (initial + addon if any)
  IF v_plan_word_quota > 0 THEN
    INSERT INTO public.word_quota_ledger (
      student_id, transaction_type, amount, balance_after,
      description, related_deal_id, created_by
    ) VALUES (
      p_student_id, 'initial', v_plan_word_quota, v_plan_word_quota,
      '方案初始字數', v_deal_id, auth.uid()
    );
    v_balance := v_plan_word_quota;
  ELSE
    v_balance := 0;
  END IF;

  v_quota_added := COALESCE(p_extra_word_quota, 0);
  IF v_quota_added > 0 THEN
    v_balance := v_balance + v_quota_added;
    INSERT INTO public.word_quota_ledger (
      student_id, transaction_type, amount, balance_after,
      description, related_deal_id, created_by
    ) VALUES (
      p_student_id, 'addon', v_quota_added, v_balance,
      '加購字數', v_deal_id, auth.uid()
    );
  END IF;

  -- Auto-transition to closed_won is now handled by the action layer
  -- (deals/actions.ts → maybeAutoCloseStudentStatus). 0026 dropped the
  -- enum-based UPDATE that used to live here.

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

NOTIFY pgrst, 'reload schema';
