-- ============================================================================
-- 0040 — Normalize existing phones in students + student_contacts
-- ============================================================================
--
-- phone-normalize §1.5: existing rows may store phones with whitespace,
-- dashes, parentheses, or +886 prefix. The frontend now normalises before
-- write (lib/utils/phone.ts) and so do server actions, but already-stored
-- rows still carry the raw input.
--
-- Algorithm mirrors normalizePhone() exactly:
--   1. ^+8869 → 09
--   2. ^+886  → 0
--   3. strip non-digits
--
-- The WHERE clause filters out rows that are already canonical (NULL or
-- exact match), so re-running this migration is a noop.
-- ============================================================================

UPDATE public.students
   SET phone = regexp_replace(
                 regexp_replace(
                   regexp_replace(phone, '^\+8869', '09'),
                   '^\+886', '0'
                 ),
                 '[^0-9]', '', 'g'
               )
 WHERE phone IS NOT NULL
   AND phone <> regexp_replace(
                  regexp_replace(
                    regexp_replace(phone, '^\+8869', '09'),
                    '^\+886', '0'
                  ),
                  '[^0-9]', '', 'g'
                );

-- Same algorithm on student_contacts.
UPDATE public.student_contacts
   SET phone = regexp_replace(
                 regexp_replace(
                   regexp_replace(phone, '^\+8869', '09'),
                   '^\+886', '0'
                 ),
                 '[^0-9]', '', 'g'
               )
 WHERE phone IS NOT NULL
   AND phone <> regexp_replace(
                  regexp_replace(
                    regexp_replace(phone, '^\+8869', '09'),
                    '^\+886', '0'
                  ),
                  '[^0-9]', '', 'g'
                );

-- Diagnostic — should return 0 rows after the migration.
-- Uncomment to verify in the Dashboard SQL Editor:
-- SELECT id, phone FROM public.students
--  WHERE phone ~ '[^0-9]' OR phone LIKE '+886%';
-- SELECT id, phone FROM public.student_contacts
--  WHERE phone ~ '[^0-9]' OR phone LIKE '+886%';

NOTIFY pgrst, 'reload schema';
