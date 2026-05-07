-- ============================================================================
-- 0039 — student_contacts (duplicate-prevention §3)
-- ============================================================================
--
-- A student can have multiple "關係人" rows (parents, guardians, relatives,
-- etc.). Two use cases:
--   1) Family members fill out the new-student form on the kid's behalf:
--      we capture them as a contact (is_primary_contact = TRUE) so the
--      consultant has someone to call when the student isn't reachable.
--   2) Back office adds contacts later as the relationship deepens.
--
-- We deliberately DO NOT enforce phone uniqueness here — siblings of the
-- same family often share one parent's phone, and that's fine.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('父親', '母親', '監護人', '親戚', '其他')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  line_id TEXT,
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_contacts_student ON public.student_contacts(student_id);

DROP TRIGGER IF EXISTS trg_student_contacts_updated_at ON public.student_contacts;
CREATE TRIGGER trg_student_contacts_updated_at
  BEFORE UPDATE ON public.student_contacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — same pattern as student_status_history: manager/admin see all,
-- consultants see only their own students' contacts.
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_contacts_select ON public.student_contacts;
CREATE POLICY student_contacts_select ON public.student_contacts
  FOR SELECT TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

DROP POLICY IF EXISTS student_contacts_insert ON public.student_contacts;
CREATE POLICY student_contacts_insert ON public.student_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (is_manager_or_admin() OR is_student_consultant(student_id))
  );

DROP POLICY IF EXISTS student_contacts_update ON public.student_contacts;
CREATE POLICY student_contacts_update ON public.student_contacts
  FOR UPDATE TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id))
  WITH CHECK (is_manager_or_admin() OR is_student_consultant(student_id));

DROP POLICY IF EXISTS student_contacts_delete ON public.student_contacts;
CREATE POLICY student_contacts_delete ON public.student_contacts
  FOR DELETE TO authenticated
  USING (is_manager_or_admin() OR is_student_consultant(student_id));

NOTIFY pgrst, 'reload schema';
