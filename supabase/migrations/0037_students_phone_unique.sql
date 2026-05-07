-- ============================================================================
-- 0037 — students.phone UNIQUE constraint (duplicate-prevention §1)
-- ============================================================================
--
-- ⚠️  TWO-STEP MIGRATION — DO NOT RUN AS A SINGLE SCRIPT.
--
-- Run Step 1 first in the Supabase Dashboard SQL Editor. If it returns ANY
-- rows, STOP and clean the duplicate phone numbers manually before running
-- Step 2 — otherwise the ALTER TABLE in Step 2 will fail.
--
-- The two steps are deliberately separated by a hard-stop comment block so
-- a careless paste-everything won't break production. PostgreSQL allows
-- multiple NULLs in a UNIQUE column natively, so phone IS NULL rows are
-- always safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 — Diagnostic. Run this alone first.
-- Expected result: 0 rows. Each row = a duplicate that must be resolved.
-- ----------------------------------------------------------------------------

SELECT phone, COUNT(*) AS cnt
FROM public.students
WHERE phone IS NOT NULL
  AND deleted_at IS NULL
GROUP BY phone
HAVING COUNT(*) > 1;

-- ============================================================================
-- ⛔  STOP HERE. Confirm Step 1 returned no rows before running Step 2.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 2 — Install the UNIQUE constraint.
-- IF NOT EXISTS guard: idempotent on re-runs.
-- ----------------------------------------------------------------------------

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_phone_unique;

ALTER TABLE public.students
  ADD CONSTRAINT students_phone_unique UNIQUE (phone);

NOTIFY pgrst, 'reload schema';
