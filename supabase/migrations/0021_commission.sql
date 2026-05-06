-- ============================================================================
-- 0021 — tuition + commission auto-create + manager-only CRUD
-- ============================================================================
--
-- Phase 4.4. Three pieces:
--
-- 1. applications gets tuition_amount + tuition_currency. Tuition lives on
--    the application (not commission_records) because it's a property of
--    the offer, not of accounting. Commission rows derive expected_amount
--    from it.
--
-- 2. Trigger fires when status crosses into 'enrolled' and the school is
--    a partner (schools.is_partner = TRUE). Inserts a commission_records
--    row if one doesn't already exist for this application. expected_amount
--    is computed from tuition_amount × rate / 100; if tuition isn't set
--    yet the row is inserted with NULL expected, and update_application_tuition
--    backfills it later.
--
-- 3. Manager-only SD functions for tuition + commission edits. Commission
--    data is sensitive (touches money), so the gate is strictly manager+
--    /admin — even the student's consultants can't see or edit it. The
--    helper _commission_authorize enforces this.
--
-- Status semantics for commission_records.status:
--   'expected'  — auto-created, awaiting invoice
--   'invoiced'  — invoice issued (invoiced_at populated)
--   'received'  — money received (received_at + actual_amount populated)
--   'cancelled' — application withdrew / school disputed / manual cancel
--
-- Behavior on status rollback (enrolled -> something else): the commission
-- row is NOT auto-deleted because it may already have been invoiced. We
-- write an activity_log entry so the manager can reconcile manually.
-- ============================================================================

-- 1. tuition columns ---------------------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS tuition_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS tuition_currency TEXT NOT NULL DEFAULT 'USD';

-- 2. authorization helper ----------------------------------------------------
CREATE OR REPLACE FUNCTION public._commission_authorize()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION '找不到 profile' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('manager_frontend', 'manager_backend', 'admin') THEN
    RAISE EXCEPTION '只有主管以上才能操作佣金資料' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._commission_authorize() FROM PUBLIC;

-- 3. enrollment trigger ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auto_create_commission_on_enroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_partner BOOLEAN;
  v_rate NUMERIC;
  v_existing UUID;
  v_expected NUMERIC;
BEGIN
  -- Only act on transitions INTO enrolled. (NEW.status = OLD.status no-ops
  -- get filtered too because they wouldn't fire UPDATE OF status, but the
  -- explicit guard documents intent.)
  IF NEW.status <> 'enrolled' THEN
    -- Backed out of enrolled: leave existing commission alone, just log.
    IF OLD.status = 'enrolled' THEN
      INSERT INTO public.activity_log (
        student_id, actor_id, action, entity_type, entity_id, payload
      ) VALUES (
        NEW.student_id, auth.uid(), 'commission_review_needed', 'application', NEW.id,
        jsonb_build_object('reason', 'rolled_out_of_enrolled', 'new_status', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'enrolled' THEN
    RETURN NEW; -- no transition, e.g. application_round changed
  END IF;

  -- Partner check
  SELECT is_partner, partner_commission_rate INTO v_is_partner, v_rate
  FROM public.schools WHERE id = NEW.school_id;
  IF NOT COALESCE(v_is_partner, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Idempotent: skip if a commission row already exists
  SELECT id INTO v_existing FROM public.commission_records
  WHERE application_id = NEW.id
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tuition_amount IS NOT NULL AND v_rate IS NOT NULL THEN
    v_expected := round(NEW.tuition_amount * v_rate / 100.0, 2);
  END IF;

  INSERT INTO public.commission_records (
    application_id, school_id, student_id,
    expected_amount, currency, status
  ) VALUES (
    NEW.id, NEW.school_id, NEW.student_id,
    v_expected, COALESCE(NEW.tuition_currency, 'USD'), 'expected'
  );

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    NEW.student_id, auth.uid(), 'commission_created', 'application', NEW.id,
    jsonb_build_object('expected_amount', v_expected, 'rate', v_rate)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_commission ON public.applications;
CREATE TRIGGER trg_auto_create_commission
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_commission_on_enroll();

-- 4. update_application_tuition (manager only; recomputes expected) ----------
CREATE OR REPLACE FUNCTION public.update_application_tuition(
  p_application_id UUID,
  p_tuition_amount NUMERIC,
  p_tuition_currency TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_school_id UUID;
  v_rate NUMERIC;
  v_currency TEXT;
  v_expected NUMERIC;
  v_existing UUID;
BEGIN
  PERFORM public._commission_authorize();

  IF p_tuition_amount IS NOT NULL AND p_tuition_amount < 0 THEN
    RAISE EXCEPTION '學費不能為負數';
  END IF;

  v_currency := NULLIF(trim(coalesce(p_tuition_currency, '')), '');
  IF v_currency IS NULL THEN
    v_currency := 'USD';
  END IF;

  UPDATE public.applications
  SET tuition_amount = p_tuition_amount,
      tuition_currency = v_currency,
      updated_at = NOW()
  WHERE id = p_application_id
  RETURNING student_id, school_id INTO v_student_id, v_school_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;

  -- Recompute commission expected if a row exists.
  SELECT id INTO v_existing FROM public.commission_records
  WHERE application_id = p_application_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    SELECT partner_commission_rate INTO v_rate
    FROM public.schools WHERE id = v_school_id;
    IF p_tuition_amount IS NOT NULL AND v_rate IS NOT NULL THEN
      v_expected := round(p_tuition_amount * v_rate / 100.0, 2);
    END IF;
    UPDATE public.commission_records
    SET expected_amount = v_expected,
        currency = v_currency,
        updated_at = NOW()
    WHERE id = v_existing;

    INSERT INTO public.activity_log (
      student_id, actor_id, action, entity_type, entity_id, payload
    ) VALUES (
      v_student_id, auth.uid(), 'commission_recomputed', 'commission_record', v_existing,
      jsonb_build_object('expected_amount', v_expected, 'tuition_amount', p_tuition_amount)
    );
  END IF;
END;
$$;

-- 5. update_commission (manager only) ----------------------------------------
CREATE OR REPLACE FUNCTION public.update_commission(
  p_id UUID,
  p_actual_amount NUMERIC,
  p_status TEXT,
  p_invoiced_at DATE,
  p_received_at DATE,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  PERFORM public._commission_authorize();

  IF p_status NOT IN ('expected', 'invoiced', 'received', 'cancelled') THEN
    RAISE EXCEPTION '無效的佣金狀態: %', p_status;
  END IF;
  IF p_actual_amount IS NOT NULL AND p_actual_amount < 0 THEN
    RAISE EXCEPTION '實收金額不能為負數';
  END IF;

  UPDATE public.commission_records
  SET actual_amount = p_actual_amount,
      status = p_status,
      invoiced_at = p_invoiced_at,
      received_at = p_received_at,
      notes = NULLIF(trim(coalesce(p_notes, '')), ''),
      updated_at = NOW()
  WHERE id = p_id
  RETURNING student_id INTO v_student_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '佣金紀錄不存在';
  END IF;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'commission_updated', 'commission_record', p_id,
    jsonb_build_object('status', p_status, 'actual_amount', p_actual_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_application_tuition(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_commission(UUID, NUMERIC, TEXT, DATE, DATE, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
