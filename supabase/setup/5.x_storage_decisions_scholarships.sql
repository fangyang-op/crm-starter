-- ============================================================================
-- Phase 5.1 / 5.2 storage buckets — application-decisions + application-scholarships
-- ============================================================================
-- Run ONCE in Supabase Dashboard SQL Editor (service_role context).
-- Idempotent: re-running is safe.
--
-- Path conventions enforced by the action layer:
--   application-decisions/{student_id}/{application_id}/offer-{ts}.pdf
--   application-decisions/{student_id}/{application_id}/rejection-{ts}.pdf
--   application-scholarships/{student_id}/{application_id}/award-{ts}.pdf
-- The student_id is folder[1] so we can reuse is_student_consultant().
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-decisions',
  'application-decisions',
  FALSE,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-scholarships',
  'application-scholarships',
  FALSE,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Decisions bucket policies
DROP POLICY IF EXISTS dec_select ON storage.objects;
DROP POLICY IF EXISTS dec_insert ON storage.objects;
DROP POLICY IF EXISTS dec_update ON storage.objects;
DROP POLICY IF EXISTS dec_delete ON storage.objects;

CREATE POLICY dec_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'application-decisions'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY dec_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'application-decisions'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY dec_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'application-decisions'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'application-decisions'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY dec_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'application-decisions'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );

-- Scholarships bucket policies (same shape, different bucket id)
DROP POLICY IF EXISTS sch_select ON storage.objects;
DROP POLICY IF EXISTS sch_insert ON storage.objects;
DROP POLICY IF EXISTS sch_update ON storage.objects;
DROP POLICY IF EXISTS sch_delete ON storage.objects;

CREATE POLICY sch_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'application-scholarships'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY sch_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'application-scholarships'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY sch_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'application-scholarships'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'application-scholarships'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY sch_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'application-scholarships'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
