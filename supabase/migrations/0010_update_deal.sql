-- ============================================================================
-- 0010 — update_deal SECURITY DEFINER (metadata-only edit)
-- ============================================================================
--
-- Edits only fields that don't affect amounts:
--   signed_at / contract_no / payment_status / notes / discount_reason
--
-- Explicitly NOT editable here:
--   plan_id, extra_school_count, extra_word_quota → would cascade to
--     word_quota_ledger and require careful inverse-entry logic
--   discount_amount, final_amount → would invalidate splits.amount
--   splits → separate concern; not exposed yet (consider separate
--     update_deal_splits function if needed later)
--
-- Permission: manager+/admin OR consultant of the deal's student (same
-- model as create_deal in 0009).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_deal(
  p_id UUID,
  p_signed_at DATE,
  p_contract_no TEXT,
  p_payment_status TEXT,
  p_discount_reason TEXT,
  p_notes TEXT
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION '找不到 profile' USING ERRCODE = '42501';
  END IF;

  SELECT student_id INTO v_student_id FROM public.deals WHERE id = p_id;
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

  IF p_payment_status NOT IN ('pending', 'partial', 'paid') THEN
    RAISE EXCEPTION '無效的付款狀態: %', p_payment_status;
  END IF;

  UPDATE public.deals SET
    signed_at = p_signed_at,
    contract_no = NULLIF(trim(coalesce(p_contract_no, '')), ''),
    payment_status = p_payment_status,
    discount_reason = NULLIF(trim(coalesce(p_discount_reason, '')), ''),
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    updated_at = NOW()
  WHERE id = p_id;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id
  ) VALUES (
    v_student_id, auth.uid(), 'deal_updated', 'deal', p_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_deal(UUID, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_deal(UUID, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;
