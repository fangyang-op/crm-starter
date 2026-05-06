-- ============================================================================
-- Phase 2.11 storage bucket — student-required-documents
-- ============================================================================
-- Run ONCE in Supabase Dashboard SQL Editor (service_role context).
-- Path convention: {student_id}/{template_code}-{ts}.<ext>
-- Allowed types: PDF + common image (some checklist items are scans, others
-- are photos of the original).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-required-documents',
  'student-required-documents',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS srd_select ON storage.objects;
DROP POLICY IF EXISTS srd_insert ON storage.objects;
DROP POLICY IF EXISTS srd_update ON storage.objects;
DROP POLICY IF EXISTS srd_delete ON storage.objects;

CREATE POLICY srd_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-required-documents'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY srd_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-required-documents'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY srd_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-required-documents'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'student-required-documents'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY srd_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-required-documents'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
