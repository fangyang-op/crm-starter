-- ============================================================================
-- 0029 — applications offer/rejection PDF paths + application_scholarships
-- ============================================================================
-- Spec § 5.1: when status flips to admitted, capture an offer letter PDF.
-- When rejected, capture a rejection letter PDF. Files live in
-- application-decisions bucket (created via setup SQL alongside this).
--
-- Spec § 5.2: each application can carry a scholarship row capturing the
-- TWD amount, a name, the award letter PDF, and notes. UI starts with a
-- single row per application; schema doesn't enforce uniqueness so a future
-- "+ 新增另一筆獎學金" button doesn't need a migration.
-- ============================================================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS offer_letter_path TEXT,
  ADD COLUMN IF NOT EXISTS rejection_letter_path TEXT;

CREATE TABLE IF NOT EXISTS public.application_scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  has_scholarship BOOLEAN NOT NULL DEFAULT FALSE,
  amount_twd NUMERIC(12, 0),
  scholarship_name TEXT,
  award_letter_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_scholarships_app
  ON public.application_scholarships(application_id);

DROP TRIGGER IF EXISTS trg_app_scholarships_updated_at ON public.application_scholarships;
CREATE TRIGGER trg_app_scholarships_updated_at
  BEFORE UPDATE ON public.application_scholarships
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.application_scholarships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_scholarships_select ON public.application_scholarships;
CREATE POLICY app_scholarships_select ON public.application_scholarships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id
        AND (public.is_manager_or_admin() OR public.is_student_consultant(a.student_id))
    )
  );

-- ============================================================================
-- SD function: set the decision file path (offer or rejection) for an
-- application. Action layer uploads the PDF to storage first then calls
-- this to persist the path.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_application_decision_file(
  p_application_id UUID,
  p_kind TEXT,           -- 'offer' | 'rejection'
  p_path TEXT             -- NULL clears the path
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id
  FROM public.applications WHERE id = p_application_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;

  PERFORM public._app_authorize(v_student_id);

  IF p_kind = 'offer' THEN
    UPDATE public.applications
    SET offer_letter_path = p_path, updated_at = NOW()
    WHERE id = p_application_id;
  ELSIF p_kind = 'rejection' THEN
    UPDATE public.applications
    SET rejection_letter_path = p_path, updated_at = NOW()
    WHERE id = p_application_id;
  ELSE
    RAISE EXCEPTION '未支援的檔案類型: %', p_kind;
  END IF;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(),
    CASE WHEN p_kind = 'offer' THEN 'application_offer_received'
         ELSE 'application_rejected' END,
    'application', p_application_id,
    jsonb_build_object('cleared', p_path IS NULL)
  );
END;
$$;

-- ============================================================================
-- SD function: upsert the scholarship record for an application. We use
-- application_id as the dedupe key for now (one row per app); when the
-- "+ 新增另一筆" button arrives we can swap to id-based.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_application_scholarship(
  p_application_id UUID,
  p_has_scholarship BOOLEAN,
  p_amount_twd NUMERIC,
  p_scholarship_name TEXT,
  p_award_letter_path TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_id UUID;
BEGIN
  SELECT student_id INTO v_student_id
  FROM public.applications WHERE id = p_application_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '申請不存在';
  END IF;

  PERFORM public._app_authorize(v_student_id);

  IF p_amount_twd IS NOT NULL AND p_amount_twd < 0 THEN
    RAISE EXCEPTION '獎學金金額不能為負數';
  END IF;

  SELECT id INTO v_id FROM public.application_scholarships
  WHERE application_id = p_application_id LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.application_scholarships (
      application_id, has_scholarship, amount_twd, scholarship_name,
      award_letter_path, notes, created_by
    ) VALUES (
      p_application_id,
      COALESCE(p_has_scholarship, FALSE),
      p_amount_twd,
      NULLIF(trim(coalesce(p_scholarship_name, '')), ''),
      NULLIF(trim(coalesce(p_award_letter_path, '')), ''),
      NULLIF(trim(coalesce(p_notes, '')), ''),
      auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.application_scholarships SET
      has_scholarship = COALESCE(p_has_scholarship, has_scholarship),
      amount_twd = p_amount_twd,
      scholarship_name = NULLIF(trim(coalesce(p_scholarship_name, '')), ''),
      award_letter_path = NULLIF(trim(coalesce(p_award_letter_path, '')), ''),
      notes = NULLIF(trim(coalesce(p_notes, '')), '')
    WHERE id = v_id;
  END IF;

  INSERT INTO public.activity_log (
    student_id, actor_id, action, entity_type, entity_id, payload
  ) VALUES (
    v_student_id, auth.uid(), 'scholarship_recorded', 'application_scholarship', v_id,
    jsonb_build_object(
      'has_scholarship', p_has_scholarship,
      'amount_twd', p_amount_twd
    )
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_application_decision_file(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_application_scholarship(UUID, BOOLEAN, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
