-- ============================================================================
-- 0041 — find_phone_anywhere(p_phone) (phone-normalize §3)
-- ============================================================================
--
-- The 代填人 (contact) phone field on the new-student form needs duplicate
-- detection too, but the meaning is different from §2A's student-phone
-- check: a parent's phone might already be registered as a student's main
-- phone OR as another student's contact, and either case is something the
-- consultant should know about.
--
-- This function queries both `students` and `student_contacts` and returns
-- up to 5 matches, tagged with `match_type`. Like find_duplicate_student_
-- by_phone, it's SECURITY DEFINER so the lookup transcends RLS — a
-- frontend consultant adding a parent already linked to a different
-- consultant's student should still see the warning.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_phone_anywhere(p_phone TEXT)
RETURNS TABLE (
  match_type TEXT,           -- 'student' | 'contact'
  match_id UUID,             -- students.id or student_contacts.id
  student_id UUID,           -- the related student (for contacts: contact.student_id)
  student_name TEXT,         -- the related student's full_name
  contact_name TEXT,         -- only set for match_type = 'contact'
  contact_relation TEXT      -- only set for match_type = 'contact'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  -- The caller already normalises (server action calls normalizePhone()
  -- before invoking this RPC), but we belt-and-braces by stripping the
  -- common separators here too.
  v_phone := regexp_replace(trim(coalesce(p_phone, '')), '[\s-]+', '', 'g');
  IF v_phone = '' OR length(v_phone) < 8 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      'student'::TEXT      AS match_type,
      s.id                 AS match_id,
      s.id                 AS student_id,
      s.full_name          AS student_name,
      NULL::TEXT           AS contact_name,
      NULL::TEXT           AS contact_relation
      FROM public.students s
     WHERE s.phone = v_phone
       AND s.deleted_at IS NULL
    UNION ALL
    SELECT
      'contact'::TEXT      AS match_type,
      c.id                 AS match_id,
      c.student_id         AS student_id,
      s2.full_name         AS student_name,
      c.name               AS contact_name,
      c.relation           AS contact_relation
      FROM public.student_contacts c
      JOIN public.students s2 ON s2.id = c.student_id
     WHERE c.phone = v_phone
       AND s2.deleted_at IS NULL
    LIMIT 5;
END;
$$;

REVOKE ALL ON FUNCTION public.find_phone_anywhere(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_phone_anywhere(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
