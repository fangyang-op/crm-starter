-- ============================================================================
-- 0017 — word quota trigger v2: enrich description, block negative balance
-- ============================================================================
--
-- Phase 3.5 audit findings:
--
-- (C) Description granularity: previous trigger wrote a fixed string
--     '文件修改扣字數' which gives consultants no clue which document the
--     deduction came from. New version writes:
--       Master:  'Master:{title} v{N}'
--       Variant: 'Variant:{master.title} v{N}'
--     so the ledger sheet (components/students/word-quota-ledger-sheet.tsx)
--     can show actionable rows.
--
-- (D-2) Block when balance insufficient: previous trigger silently allowed
--     balance_after to go negative. Per product decision, edits should be
--     refused when the student has insufficient quota; the user should be
--     prompted to top up.
--
--     Implementation: trigger RAISE EXCEPTION with a tagged message
--     'INSUFFICIENT_WORD_QUOTA: ...'. Because triggers run inside the same
--     transaction as the parent INSERT, the exception rolls back the version
--     row insert too — student does not get charged AND does not get a saved
--     version. The action layer (app/.../documents/actions.ts) detects the
--     'INSUFFICIENT_WORD_QUOTA:' prefix and surfaces a friendly Chinese
--     toast with top-up guidance.
--
-- (D-1) Concurrent balance race deferred — internal CRM with ~50 users,
--     low collision probability. Will revisit if drift appears.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_ledger_on_version_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_current_balance INTEGER;
  v_doc_title TEXT;
  v_description TEXT;
  v_shortfall INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'documents_master_versions' THEN
    SELECT student_id, title INTO v_student_id, v_doc_title
    FROM documents_master WHERE id = NEW.master_id;
    v_description := 'Master:' || coalesce(v_doc_title, '(無標題)') || ' v' || NEW.version_number;
  ELSIF TG_TABLE_NAME = 'documents_variant_versions' THEN
    SELECT dm.student_id, dm.title INTO v_student_id, v_doc_title
    FROM documents_variants dv
    JOIN documents_master dm ON dm.id = dv.master_id
    WHERE dv.id = NEW.variant_id;
    v_description := 'Variant:' || coalesce(v_doc_title, '(無標題)') || ' v' || NEW.version_number;
  END IF;

  -- Only deduct when diff > 0
  IF NEW.word_diff_from_previous > 0 AND v_student_id IS NOT NULL THEN
    SELECT COALESCE(balance_after, 0) INTO v_current_balance
    FROM word_quota_ledger
    WHERE student_id = v_student_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_current_balance IS NULL THEN v_current_balance := 0; END IF;

    -- D-2: block insufficient balance. Tagged message lets the action layer
    -- surface a localized toast.
    IF v_current_balance < NEW.word_diff_from_previous THEN
      v_shortfall := NEW.word_diff_from_previous - v_current_balance;
      RAISE EXCEPTION
        'INSUFFICIENT_WORD_QUOTA: 字數餘額不足。本次需扣 %、目前餘額 %、缺少 %。請聯絡前端顧問加碼或請學生加購字數方案後再儲存。',
        NEW.word_diff_from_previous, v_current_balance, v_shortfall
        USING ERRCODE = '53400';  -- configuration_limit_exceeded
    END IF;

    INSERT INTO word_quota_ledger (
      student_id, transaction_type, amount, balance_after,
      description, related_master_version_id, related_variant_version_id, created_by
    ) VALUES (
      v_student_id, 'used',
      -NEW.word_diff_from_previous,
      v_current_balance - NEW.word_diff_from_previous,
      v_description,
      CASE WHEN TG_TABLE_NAME = 'documents_master_versions' THEN NEW.id ELSE NULL END,
      CASE WHEN TG_TABLE_NAME = 'documents_variant_versions' THEN NEW.id ELSE NULL END,
      NEW.modified_by
    );
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
