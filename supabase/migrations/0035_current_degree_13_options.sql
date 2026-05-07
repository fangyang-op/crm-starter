-- ============================================================================
-- 0035 — students.current_degree: 13 fixed Chinese options
-- ============================================================================
--
-- v1.1 §2: Replace the legacy English code values
--   ('high_school', 'bachelor', 'master', 'phd', 'other')
-- with 13 grade/role labels in Chinese that the form already gates by zod.
-- The spec's mapping (best-effort; un-mappable rows go to NULL so consultants
-- can re-fill on next visit):
--
--   bachelor             → 大四
--   master               → 在台碩士
--   phd, other           → 在職人士
--   high_school          → NULL  (can't tell which grade; spec is silent here)
--
-- After data migration, install a CHECK constraint so the DB is the source
-- of truth (the prior schema had no constraint — zod was the only gate).
-- ============================================================================

-- 1) Migrate existing rows. Order matters: do the English-code migrations
--    BEFORE the catch-all so we don't overwrite the new values we just wrote.
UPDATE public.students SET current_degree = '大四'    WHERE current_degree = 'bachelor';
UPDATE public.students SET current_degree = '在台碩士' WHERE current_degree = 'master';
UPDATE public.students SET current_degree = '在職人士' WHERE current_degree IN ('phd', 'other');
UPDATE public.students SET current_degree = NULL      WHERE current_degree = 'high_school';

-- Catch-all for anything else that doesn't match the 13 new values (and
-- isn't already NULL): null it out so the upcoming CHECK doesn't fail.
UPDATE public.students
   SET current_degree = NULL
 WHERE current_degree IS NOT NULL
   AND current_degree NOT IN (
     '國一','國二','國三',
     '高一','高二','高三',
     '大一','大二','大三','大四','大五',
     '在台碩士','在職人士'
   );

-- 2) Install the CHECK constraint. Drop first in case a prior run left one
--    in place (idempotent re-runs).
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_current_degree_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_current_degree_check
  CHECK (
    current_degree IS NULL OR current_degree IN (
      '國一','國二','國三',
      '高一','高二','高三',
      '大一','大二','大三','大四','大五',
      '在台碩士','在職人士'
    )
  );

NOTIFY pgrst, 'reload schema';
