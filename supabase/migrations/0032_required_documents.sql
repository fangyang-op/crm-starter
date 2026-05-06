-- ============================================================================
-- 0032 — document_templates + student_required_documents (spec § 2.11)
-- ============================================================================
-- document_templates is the org-wide checklist; student_required_documents
-- is per-student, with a status field tracking pending/uploaded/verified/
-- rejected. is_required is a per-student override of the template default
-- so back-end consultants can decide which docs apply to a given student.
--
-- The 13 seed entries come from Appendix A of the spec.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label_zh TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('school_application', 'visa_enrollment', 'other')),
  description TEXT,
  notes TEXT,
  default_required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_templates_select ON public.document_templates;
CREATE POLICY document_templates_select ON public.document_templates
  FOR SELECT TO authenticated USING (TRUE);

-- Seed Appendix A — school_application (sort 10..90) + visa_enrollment (110..140)
INSERT INTO public.document_templates (code, label_zh, category, notes, sort_order)
SELECT * FROM (VALUES
  ('student_data_form', '學生資料表格', 'school_application',
    '申請學校前須填寫完整', 10),
  ('passport_copy', '護照影本', 'school_application',
    '彩色掃描檔案並簽名於「持照人簽名欄位」;需要有兩年以上有效期', 20),
  ('electronic_signature', '電子簽名', 'school_application',
    '須與護照簽名一致,學校申請時需要', 30),
  ('id_card', '身分證正反面', 'school_application',
    '請將正反面彩色或拍照掃描上傳', 40),
  ('transcript_zh_en', '中英在校成績單', 'school_application',
    '在學中:截至大三上;已畢業:完整成績單,包含畢業年月份、學位名稱', 50),
  ('enrollment_certificate_zh_en', '中英在學證明', 'school_application',
    '在學中需提供', 60),
  ('diploma_zh_en', '中英畢業證書', 'school_application',
    '已畢業需提供;需檢查:是否有完整畢業年月份、護照相同英文名字、學位名稱(Bachelor of xxx)', 70),
  ('english_test_score', '英文考試成績單', 'school_application',
    '官方電子檔', 80),
  ('sealed_transcript_x2', '彌封的中英文成績單 ×2', 'school_application',
    '需開於申請學校及申請副份備用;需要時時機:學校申請階段要求 WES 認證、學校紙本要求、辦理入學手續交', 90),
  ('entry_exit_record', '出入境證明(出生到現在)', 'visa_enrollment',
    '需至內政部移民署設櫃申請(請勿線上申請!);需申請時包含家名稱、轉機資訊等版本', 110),
  ('degree_certificate_zh_en', '中英學位證明', 'visa_enrollment',
    '辦理入學時繳交(用於代替畢業證書,因為學校收到資料後不易遞給學生)', 120),
  ('financial_proof_zh_en', '中英財力證明', 'visa_enrollment',
    '拿到銀行信徒查更換提供來源及注意事項', 130),
  ('household_registration_zh_en', '中英戶籍謄本', 'visa_enrollment',
    '如果來自財力證明之帳戶非學生本人需提供', 140)
) AS v(code, label_zh, category, notes, sort_order)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- student_required_documents — per-student state
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_required_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_template_id UUID NOT NULL REFERENCES public.document_templates(id),
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'verified', 'rejected')),
  file_path TEXT,
  uploaded_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, document_template_id)
);
CREATE INDEX IF NOT EXISTS idx_srd_student
  ON public.student_required_documents(student_id);

DROP TRIGGER IF EXISTS trg_srd_updated_at ON public.student_required_documents;
CREATE TRIGGER trg_srd_updated_at
  BEFORE UPDATE ON public.student_required_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.student_required_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS srd_select ON public.student_required_documents;
CREATE POLICY srd_select ON public.student_required_documents
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin() OR public.is_student_consultant(student_id));

-- ============================================================================
-- SD: upsert per-student row (toggle is_required + persist a file path).
-- ============================================================================
CREATE OR REPLACE FUNCTION public._srd_authorize(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role user_role; v_authorized BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IN ('manager_frontend', 'manager_backend', 'admin') THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = p_student_id
      AND deleted_at IS NULL
      AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
  ) INTO v_authorized;
  IF NOT v_authorized THEN
    RAISE EXCEPTION '無權限操作此學生申請文件' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._srd_authorize(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.toggle_required_document(
  p_student_id UUID,
  p_template_id UUID,
  p_is_required BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM public._srd_authorize(p_student_id);

  INSERT INTO public.student_required_documents (
    student_id, document_template_id, is_required, status
  ) VALUES (
    p_student_id, p_template_id, p_is_required, 'pending'
  )
  ON CONFLICT (student_id, document_template_id) DO UPDATE
    SET is_required = EXCLUDED.is_required, updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_required_document_file(
  p_student_id UUID,
  p_template_id UUID,
  p_file_path TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM public._srd_authorize(p_student_id);

  INSERT INTO public.student_required_documents (
    student_id, document_template_id, is_required,
    status, file_path, uploaded_at, uploaded_by
  ) VALUES (
    p_student_id, p_template_id, TRUE,
    CASE WHEN p_file_path IS NULL THEN 'pending' ELSE 'uploaded' END,
    p_file_path,
    CASE WHEN p_file_path IS NULL THEN NULL ELSE NOW() END,
    CASE WHEN p_file_path IS NULL THEN NULL ELSE auth.uid() END
  )
  ON CONFLICT (student_id, document_template_id) DO UPDATE
    SET file_path = p_file_path,
        status = CASE WHEN p_file_path IS NULL THEN 'pending' ELSE 'uploaded' END,
        uploaded_at = CASE WHEN p_file_path IS NULL THEN NULL ELSE NOW() END,
        uploaded_by = CASE WHEN p_file_path IS NULL THEN NULL ELSE auth.uid() END,
        verified_at = NULL,
        verified_by = NULL,
        updated_at = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_required_document_status(
  p_id UUID,
  p_status TEXT,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_student_id UUID;
BEGIN
  SELECT student_id INTO v_student_id
  FROM public.student_required_documents WHERE id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '紀錄不存在';
  END IF;
  PERFORM public._srd_authorize(v_student_id);

  IF p_status NOT IN ('pending', 'uploaded', 'verified', 'rejected') THEN
    RAISE EXCEPTION '無效的狀態: %', p_status;
  END IF;

  UPDATE public.student_required_documents SET
    status = p_status,
    notes = NULLIF(trim(coalesce(p_notes, '')), ''),
    verified_at = CASE WHEN p_status = 'verified' THEN NOW() ELSE NULL END,
    verified_by = CASE WHEN p_status = 'verified' THEN auth.uid() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_required_document(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_required_document_file(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_required_document_status(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
