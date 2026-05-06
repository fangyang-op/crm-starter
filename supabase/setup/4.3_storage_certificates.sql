-- ============================================================================
-- Phase 4.3 — student-certificates storage bucket + RLS
-- ============================================================================
--
-- Run this ONCE in Supabase Dashboard → SQL Editor (it INSERTs into
-- storage.buckets which only service_role can do; the Editor runs with
-- service_role privileges, so this works).
--
-- Idempotent: re-running is safe — the inserts use ON CONFLICT and the
-- policies are dropped + recreated.
--
-- Path convention enforced by the action layer:
--   {student_id}/{score_id}/{filename}
-- so the storage policies use storage.foldername(name)[1] (= student_id)
-- to reuse our existing is_manager_or_admin() / is_student_consultant()
-- helpers.
--
-- File constraints:
--   * 10 MB cap (10 * 1024 * 1024 bytes)
--   * MIME allowlist: image/png, image/jpeg, image/webp, application/pdf
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-certificates',
  'student-certificates',
  FALSE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- Storage RLS — same gate as academic_scores RLS
-- ============================================================================
-- We drop existing policies of the same name first so this script stays
-- idempotent. Names are namespaced with `cert_` to avoid clashing with any
-- future buckets that reuse the certificate path convention.
-- ============================================================================

DROP POLICY IF EXISTS cert_select ON storage.objects;
DROP POLICY IF EXISTS cert_insert ON storage.objects;
DROP POLICY IF EXISTS cert_update ON storage.objects;
DROP POLICY IF EXISTS cert_delete ON storage.objects;

CREATE POLICY cert_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-certificates'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY cert_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-certificates'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY cert_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-certificates'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'student-certificates'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );

CREATE POLICY cert_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-certificates'
    AND (
      public.is_manager_or_admin()
      OR public.is_student_consultant(((storage.foldername(name))[1])::uuid)
    )
  );
