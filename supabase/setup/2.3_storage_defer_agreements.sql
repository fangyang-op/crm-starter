-- ============================================================================
-- Phase 2.3 storage bucket — student-defer-agreements
-- ============================================================================
-- Run ONCE in Supabase Dashboard SQL Editor (service_role context).
-- PDF only, 10MB cap, gated by student_id prefix in the path.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-defer-agreements',
  'student-defer-agreements',
  FALSE,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS defer_select ON storage.objects;
DROP POLICY IF EXISTS defer_insert ON storage.objects;
DROP POLICY IF EXISTS defer_update ON storage.objects;
DROP POLICY IF EXISTS defer_delete ON storage.objects;

CREATE POLICY defer_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-defer-agreements'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY defer_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-defer-agreements'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY defer_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-defer-agreements'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'student-defer-agreements'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY defer_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-defer-agreements'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
