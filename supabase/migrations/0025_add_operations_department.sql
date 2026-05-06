-- ============================================================================
-- 0025 — Add 'operations' to department enum
-- ============================================================================
--
-- Per product call: introduce a third department, "營運" (operations).
-- It's nominal for now — no automation hangs on it, but admins can assign
-- people to it through the user-management UI.
--
-- ALTER TYPE ADD VALUE is non-transactional pre-PG12, but Supabase runs
-- a recent PostgreSQL where it's safe inside DO blocks. We still guard
-- with a NOT EXISTS check so re-running this migration is a no-op.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'department' AND e.enumlabel = 'operations'
  ) THEN
    ALTER TYPE public.department ADD VALUE 'operations';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
