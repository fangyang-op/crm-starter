-- ============================================================================
-- 留學代辦 CRM 系統 - 初始 Schema Migration
-- 版本:0001
-- 日期:Phase 0 起點
-- 執行方式:複製整份貼進 Supabase Dashboard → SQL Editor → Run
-- ============================================================================

-- 啟用必要 extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'consultant',
  'manager_frontend',
  'manager_backend',
  'admin'
);

CREATE TYPE department AS ENUM (
  'frontend',
  'backend'
);

CREATE TYPE student_status AS ENUM (
  -- 招生階段
  'new_lead', 'contacted', 'consulting', 'qualified', 'disqualified',
  -- 成交分水嶺
  'closed_won',
  -- 申請階段
  'onboarding', 'school_selection', 'document_prep', 'submitting',
  'awaiting_decision', 'decision_making', 'pre_departure', 'enrolled',
  -- 特殊
  'paused', 'terminated'
);

CREATE TYPE lead_source_type AS ENUM (
  'self_developed',
  'marketing_dept',
  'consultant_referral',
  'external_referrer',
  'brand_introduction',
  'other'
);

CREATE TYPE document_type AS ENUM (
  'cv', 'sop', 'lor', 'transcript', 'other'
);

CREATE TYPE score_type AS ENUM (
  'gpa', 'toefl', 'ielts', 'gre', 'gmat', 'sat', 'duolingo', 'other'
);

CREATE TYPE application_status AS ENUM (
  'pending_send', 'submitted', 'docs_required', 'interview',
  'admitted', 'rejected', 'waitlisted', 'declined_by_us', 'enrolled'
);

CREATE TYPE word_quota_transaction_type AS ENUM (
  'initial', 'addon', 'bonus', 'used', 'refund', 'adjustment'
);

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 profiles ----------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'consultant',
  department department,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_department ON public.profiles(department);

-- 2.2 referrers (外部轉介人) --------------------------------------------------
CREATE TABLE public.referrers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'individual' | 'organization' | 'school' | 'partner'
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 students ----------------------------------------------------------------
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  full_name TEXT NOT NULL,
  english_name TEXT,
  email TEXT,
  phone TEXT,
  line_id TEXT,
  birth_date DATE,
  
  current_school TEXT,
  current_major TEXT,
  current_degree TEXT,
  graduation_year INTEGER,
  
  target_country TEXT[],
  target_degree TEXT,
  target_major TEXT,
  target_intake TEXT,
  
  status student_status NOT NULL DEFAULT 'new_lead',
  frontend_consultant_id UUID REFERENCES public.profiles(id),
  backend_consultant_id UUID REFERENCES public.profiles(id),
  
  lead_source_type lead_source_type NOT NULL DEFAULT 'self_developed',
  lead_source_user_id UUID REFERENCES public.profiles(id),
  lead_source_referrer_id UUID REFERENCES public.referrers(id),
  lead_source_note TEXT,
  
  notes TEXT,
  tags TEXT[],
  
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_status ON public.students(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_frontend ON public.students(frontend_consultant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_backend ON public.students(backend_consultant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_deleted ON public.students(deleted_at);

-- 2.4 student_status_history --------------------------------------------------
CREATE TABLE public.student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_status student_status,
  to_status student_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_student ON public.student_status_history(student_id, changed_at DESC);

-- 2.5 consultant_handovers ----------------------------------------------------
CREATE TABLE public.consultant_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  handover_type TEXT NOT NULL,
  from_consultant_id UUID REFERENCES public.profiles(id),
  to_consultant_id UUID NOT NULL REFERENCES public.profiles(id),
  initiated_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  handed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 service_plans -----------------------------------------------------------
CREATE TABLE public.service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD',
  included_school_count INTEGER,
  included_word_quota INTEGER,
  scope_country TEXT[],
  scope_degree TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 addon_pricing -----------------------------------------------------------
CREATE TABLE public.addon_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 deals -------------------------------------------------------------------
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id),
  plan_id UUID NOT NULL REFERENCES public.service_plans(id),
  
  extra_school_count INTEGER NOT NULL DEFAULT 0,
  extra_word_quota INTEGER NOT NULL DEFAULT 0,
  
  base_amount NUMERIC(10,2) NOT NULL,
  addon_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TWD',
  
  discount_reason TEXT,
  signed_at DATE NOT NULL,
  contract_no TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deals_student ON public.deals(student_id);
CREATE INDEX idx_deals_signed ON public.deals(signed_at DESC);

-- 2.9 deal_commission_splits --------------------------------------------------
CREATE TABLE public.deal_commission_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  
  recipient_user_id UUID REFERENCES public.profiles(id),
  recipient_referrer_id UUID REFERENCES public.referrers(id),
  
  role_in_deal TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  amount NUMERIC(10,2),
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_one_recipient CHECK (
    (recipient_user_id IS NOT NULL AND recipient_referrer_id IS NULL) OR
    (recipient_user_id IS NULL AND recipient_referrer_id IS NOT NULL)
  )
);

CREATE INDEX idx_splits_deal ON public.deal_commission_splits(deal_id);
CREATE INDEX idx_splits_user ON public.deal_commission_splits(recipient_user_id);

-- 2.10 schools ----------------------------------------------------------------
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_zh TEXT,
  short_name TEXT,
  country TEXT NOT NULL,
  state_or_region TEXT,
  city TEXT,
  website TEXT,
  ranking_qs INTEGER,
  ranking_us_news INTEGER,
  is_partner BOOLEAN NOT NULL DEFAULT FALSE,
  partner_commission_rate NUMERIC(5,2),
  partner_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schools_country ON public.schools(country);

-- 2.11 school_programs --------------------------------------------------------
CREATE TABLE public.school_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  degree_level TEXT NOT NULL,
  major_category TEXT,
  application_deadline_round1 DATE,
  application_deadline_round2 DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programs_school ON public.school_programs(school_id);

-- 2.12 school_lists -----------------------------------------------------------
CREATE TABLE public.school_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, version_number)
);

-- 同一學生只允許一個 is_current=true
CREATE UNIQUE INDEX idx_school_lists_one_current 
  ON public.school_lists(student_id) 
  WHERE is_current = TRUE;

-- 2.13 school_list_items ------------------------------------------------------
CREATE TABLE public.school_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_list_id UUID NOT NULL REFERENCES public.school_lists(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id),
  program_id UUID REFERENCES public.school_programs(id),
  program_name_override TEXT,
  tier TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_list_items_list ON public.school_list_items(school_list_id);

-- 2.14 applications -----------------------------------------------------------
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id),
  program_id UUID REFERENCES public.school_programs(id),
  program_name_override TEXT,
  source_school_list_item_id UUID REFERENCES public.school_list_items(id),
  
  status application_status NOT NULL DEFAULT 'pending_send',
  application_round TEXT,
  deadline DATE,
  submitted_at TIMESTAMPTZ,
  decision_at TIMESTAMPTZ,
  decision_notes TEXT,
  
  portal_url TEXT,
  portal_username TEXT,
  portal_password_encrypted TEXT,  -- AES-256-GCM, never plaintext
  portal_notes TEXT,
  
  application_fee NUMERIC(10,2),
  application_fee_paid BOOLEAN DEFAULT FALSE,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_student ON public.applications(student_id);
CREATE INDEX idx_applications_school ON public.applications(school_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_deadline ON public.applications(deadline);

-- 2.15 documents_master -------------------------------------------------------
CREATE TABLE public.documents_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  doc_type document_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  current_version_id UUID,  -- FK 後補
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_master_student ON public.documents_master(student_id);

-- 2.16 documents_master_versions ----------------------------------------------
CREATE TABLE public.documents_master_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES public.documents_master(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT,
  storage_path TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  word_diff_from_previous INTEGER NOT NULL DEFAULT 0,
  change_note TEXT,
  modified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(master_id, version_number)
);

-- 補上 documents_master.current_version_id 的 FK
ALTER TABLE public.documents_master 
  ADD CONSTRAINT fk_doc_master_current_version 
  FOREIGN KEY (current_version_id) REFERENCES public.documents_master_versions(id);

-- 2.17 documents_variants -----------------------------------------------------
CREATE TABLE public.documents_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES public.documents_master(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  forked_from_master_version_id UUID REFERENCES public.documents_master_versions(id),
  current_version_id UUID,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(master_id, application_id)
);

-- 2.18 documents_variant_versions ---------------------------------------------
CREATE TABLE public.documents_variant_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.documents_variants(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT,
  storage_path TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  word_diff_from_previous INTEGER NOT NULL DEFAULT 0,
  change_note TEXT,
  modified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(variant_id, version_number)
);

ALTER TABLE public.documents_variants 
  ADD CONSTRAINT fk_doc_variant_current_version 
  FOREIGN KEY (current_version_id) REFERENCES public.documents_variant_versions(id);

-- 2.19 word_quota_ledger ------------------------------------------------------
CREATE TABLE public.word_quota_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  transaction_type word_quota_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  related_deal_id UUID REFERENCES public.deals(id),
  related_master_version_id UUID REFERENCES public.documents_master_versions(id),
  related_variant_version_id UUID REFERENCES public.documents_variant_versions(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_student ON public.word_quota_ledger(student_id, created_at DESC);

-- 2.20 academic_scores --------------------------------------------------------
CREATE TABLE public.academic_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score_type score_type NOT NULL,
  total_score TEXT,
  sub_scores JSONB,
  test_date DATE,
  expiry_date DATE,
  certificate_storage_path TEXT,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_student ON public.academic_scores(student_id);

-- 2.21 commission_records -----------------------------------------------------
CREATE TABLE public.commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id),
  school_id UUID NOT NULL REFERENCES public.schools(id),
  student_id UUID NOT NULL REFERENCES public.students(id),
  expected_amount NUMERIC(10,2),
  actual_amount NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'expected',
  invoiced_at DATE,
  received_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.22 activity_log -----------------------------------------------------------
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_student ON public.activity_log(student_id, created_at DESC);
CREATE INDEX idx_activity_actor ON public.activity_log(actor_id, created_at DESC);

-- ============================================================================
-- 3. HELPER FUNCTIONS(角色判斷)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('manager_frontend', 'manager_backend', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_student_consultant(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND deleted_at IS NULL
      AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
  )
$$;

-- ============================================================================
-- 4. AUTO-UPDATE updated_at TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 為每張有 updated_at 的表建 trigger
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================================
-- 5. STATUS HISTORY TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO student_status_history (student_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_by);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO student_status_history (student_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_students_status_history
  AFTER INSERT OR UPDATE OF status ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_status_change();

-- ============================================================================
-- 6. WORD QUOTA AUTO-LEDGER TRIGGER
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
BEGIN
  IF TG_TABLE_NAME = 'documents_master_versions' THEN
    SELECT student_id INTO v_student_id 
    FROM documents_master WHERE id = NEW.master_id;
  ELSIF TG_TABLE_NAME = 'documents_variant_versions' THEN
    SELECT dm.student_id INTO v_student_id
    FROM documents_variants dv
    JOIN documents_master dm ON dm.id = dv.master_id
    WHERE dv.id = NEW.variant_id;
  END IF;
  
  -- 只有差 > 0 才扣
  IF NEW.word_diff_from_previous > 0 AND v_student_id IS NOT NULL THEN
    SELECT COALESCE(balance_after, 0) INTO v_current_balance
    FROM word_quota_ledger
    WHERE student_id = v_student_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_current_balance IS NULL THEN v_current_balance := 0; END IF;
    
    INSERT INTO word_quota_ledger (
      student_id, transaction_type, amount, balance_after,
      description, related_master_version_id, related_variant_version_id, created_by
    ) VALUES (
      v_student_id, 'used',
      -NEW.word_diff_from_previous,
      v_current_balance - NEW.word_diff_from_previous,
      '文件修改扣字數',
      CASE WHEN TG_TABLE_NAME = 'documents_master_versions' THEN NEW.id ELSE NULL END,
      CASE WHEN TG_TABLE_NAME = 'documents_variant_versions' THEN NEW.id ELSE NULL END,
      NEW.modified_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_master_version_ledger
  AFTER INSERT ON public.documents_master_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_version_insert();

CREATE TRIGGER trg_variant_version_ledger
  AFTER INSERT ON public.documents_variant_versions
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_on_version_insert();

-- ============================================================================
-- 7. PROFILE 防自我提權 TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- admin 跳過此檢查
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;
  
  IF NEW.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role 
       OR NEW.department IS DISTINCT FROM OLD.department
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION '無權變更角色、部門或啟用狀態';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_prevent_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_self_role_change();

-- ============================================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- profiles --------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (TRUE);  -- 所有已登入使用者可查所有 profile(顯示姓名等用)

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- referrers -------------------------------------------------------------------
ALTER TABLE public.referrers ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrers_select ON public.referrers
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY referrers_write ON public.referrers
  FOR ALL TO authenticated
  USING (is_manager_or_admin())
  WITH CHECK (is_manager_or_admin());

-- students --------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_select ON public.students
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      is_manager_or_admin()
      OR frontend_consultant_id = auth.uid()
      OR backend_consultant_id = auth.uid()
    )
  );

CREATE POLICY students_insert ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (is_manager_or_admin() OR frontend_consultant_id = auth.uid())
  );

CREATE POLICY students_update ON public.students
  FOR UPDATE TO authenticated
  USING (
    is_manager_or_admin()
    OR frontend_consultant_id = auth.uid()
    OR backend_consultant_id = auth.uid()
  )
  WITH CHECK (
    is_manager_or_admin()
    OR frontend_consultant_id = auth.uid()
    OR backend_consultant_id = auth.uid()
  );

-- 不建 DELETE policy = 預設拒絕(用 update deleted_at 取代)

-- student_status_history ------------------------------------------------------
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY status_hist_select ON public.student_status_history
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

-- INSERT 不建 policy(由 trigger 寫入,trigger 是 SECURITY DEFINER)

-- consultant_handovers --------------------------------------------------------
ALTER TABLE public.consultant_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY handovers_select ON public.consultant_handovers
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

CREATE POLICY handovers_insert ON public.consultant_handovers
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_admin());

-- service_plans ---------------------------------------------------------------
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select ON public.service_plans
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY plans_write ON public.service_plans
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- addon_pricing ---------------------------------------------------------------
ALTER TABLE public.addon_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY addon_select ON public.addon_pricing
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY addon_write ON public.addon_pricing
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- deals -----------------------------------------------------------------------
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY deals_select ON public.deals
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

CREATE POLICY deals_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

CREATE POLICY deals_update ON public.deals
  FOR UPDATE TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id))
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

-- deal_commission_splits ------------------------------------------------------
ALTER TABLE public.deal_commission_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY splits_select ON public.deal_commission_splits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_id
        AND (is_manager_or_admin() OR is_student_consultant(d.student_id))
    )
  );

CREATE POLICY splits_write ON public.deal_commission_splits
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_id
        AND (is_manager_or_admin() OR is_student_consultant(d.student_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_id
        AND (is_manager_or_admin() OR is_student_consultant(d.student_id))
    )
  );

-- schools ---------------------------------------------------------------------
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY schools_select ON public.schools
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY schools_write ON public.schools
  FOR ALL TO authenticated
  USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- school_programs -------------------------------------------------------------
ALTER TABLE public.school_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY programs_select ON public.school_programs
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY programs_write ON public.school_programs
  FOR ALL TO authenticated
  USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- school_lists ----------------------------------------------------------------
ALTER TABLE public.school_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_lists_select ON public.school_lists
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

CREATE POLICY school_lists_write ON public.school_lists
  FOR ALL TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id))
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

-- school_list_items -----------------------------------------------------------
ALTER TABLE public.school_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY list_items_all ON public.school_list_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM school_lists sl
      WHERE sl.id = school_list_id
        AND (is_manager_or_admin() OR is_student_consultant(sl.student_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM school_lists sl
      WHERE sl.id = school_list_id
        AND (is_manager_or_admin() OR is_student_consultant(sl.student_id))
    )
  );

-- applications ----------------------------------------------------------------
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY applications_select ON public.applications
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

CREATE POLICY applications_write ON public.applications
  FOR ALL TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id))
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

-- documents_master ------------------------------------------------------------
ALTER TABLE public.documents_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_master_all ON public.documents_master
  FOR ALL TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id))
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

-- documents_master_versions ---------------------------------------------------
ALTER TABLE public.documents_master_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_master_v_all ON public.documents_master_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents_master dm
      WHERE dm.id = master_id
        AND (is_manager_or_admin() OR is_student_consultant(dm.student_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents_master dm
      WHERE dm.id = master_id
        AND (is_manager_or_admin() OR is_student_consultant(dm.student_id))
    )
  );

-- documents_variants ----------------------------------------------------------
ALTER TABLE public.documents_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_variant_all ON public.documents_variants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents_master dm
      WHERE dm.id = master_id
        AND (is_manager_or_admin() OR is_student_consultant(dm.student_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents_master dm
      WHERE dm.id = master_id
        AND (is_manager_or_admin() OR is_student_consultant(dm.student_id))
    )
  );

-- documents_variant_versions --------------------------------------------------
ALTER TABLE public.documents_variant_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_variant_v_all ON public.documents_variant_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents_variants dv
      JOIN documents_master dm ON dm.id = dv.master_id
      WHERE dv.id = variant_id
        AND (is_manager_or_admin() OR is_student_consultant(dm.student_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents_variants dv
      JOIN documents_master dm ON dm.id = dv.master_id
      WHERE dv.id = variant_id
        AND (is_manager_or_admin() OR is_student_consultant(dm.student_id))
    )
  );

-- word_quota_ledger -----------------------------------------------------------
ALTER TABLE public.word_quota_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_select ON public.word_quota_ledger
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

CREATE POLICY ledger_insert ON public.word_quota_ledger
  FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

-- 不建 UPDATE/DELETE policy = 帳本只能追加

-- academic_scores -------------------------------------------------------------
ALTER TABLE public.academic_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY scores_all ON public.academic_scores
  FOR ALL TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id))
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

-- commission_records ----------------------------------------------------------
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_select ON public.commission_records
  FOR SELECT TO authenticated
  USING (is_manager_or_admin());

CREATE POLICY commission_write ON public.commission_records
  FOR ALL TO authenticated
  USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- activity_log ----------------------------------------------------------------
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_select ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    is_manager_or_admin()
    OR (student_id IS NOT NULL AND is_student_consultant(student_id))
  );

CREATE POLICY activity_insert ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_admin()
    OR (student_id IS NOT NULL AND is_student_consultant(student_id))
  );

-- ============================================================================
-- 9. 預設資料 SEED(可選)
-- ============================================================================

-- 預設加購單價(可在 admin 後台改)
INSERT INTO public.addon_pricing (type, name, unit_price, currency) VALUES
  ('extra_school', '加購一所學校', 8000, 'TWD'),
  ('extra_word_per_1000', '加購字數(每 1000 字)', 5000, 'TWD');

-- 預設範例方案(可改/刪)
INSERT INTO public.service_plans (code, name, description, base_price, included_school_count, included_word_quota, scope_country, scope_degree, display_order)
VALUES
  ('US-MASTER-10', '美碩 10 校旗艦', '美國碩士申請 10 所', 180000, 10, 30000, ARRAY['US'], ARRAY['master'], 1),
  ('US-MASTER-5', '美碩 5 校精選', '美國碩士申請 5 所', 120000, 5, 15000, ARRAY['US'], ARRAY['master'], 2),
  ('UK-MASTER-5', '英碩 5 校', '英國碩士申請 5 所', 100000, 5, 15000, ARRAY['UK'], ARRAY['master'], 3);

-- ============================================================================
-- DONE
-- 執行後請至 Supabase Dashboard → Table Editor 確認 22 張表都建立成功
-- ============================================================================
