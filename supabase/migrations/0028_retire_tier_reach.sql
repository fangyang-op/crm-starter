-- ============================================================================
-- 0028 — retire school_list_items.tier 'reach', rename match → 合適 (UI only)
-- ============================================================================
-- Spec § 4.1. The product call (2026-05-06) was: existing 'reach' rows
-- collapse into 'match' (the closest neighbour). The DB constraint is then
-- tightened so future writes can't reintroduce it.
--
-- The Chinese label '匹配 → 合適' rename lives in lib/constants/tier.ts —
-- DB still stores the canonical 'match' code, no schema change for that.
-- ============================================================================

-- 1. Migrate any existing 'reach' rows to 'match'.
UPDATE public.school_list_items SET tier = 'match' WHERE tier = 'reach';

-- 2. Tighten the check constraint to refuse 'reach' going forward.
ALTER TABLE public.school_list_items
  DROP CONSTRAINT IF EXISTS school_list_items_tier_check;
ALTER TABLE public.school_list_items
  ADD CONSTRAINT school_list_items_tier_check
  CHECK (tier IN ('dream', 'match', 'safety'));

-- 3. Update the SD CRUD functions in 0013 to drop 'reach' from their checks.
--    We replace the two functions in place. Bodies are identical to 0013
--    aside from the validation list.
CREATE OR REPLACE FUNCTION public.add_school_list_item(
  p_list_id UUID,
  p_school_id UUID,
  p_program_id UUID,
  p_program_name_override TEXT,
  p_tier TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_locked BOOLEAN;
  v_id UUID;
  v_next_order INTEGER;
BEGIN
  SELECT student_id, is_locked INTO v_student_id, v_locked
  FROM public.school_lists WHERE id = p_list_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '選校表不存在';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION '此版本已鎖定,不可修改';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  IF p_tier NOT IN ('dream', 'match', 'safety') THEN
    RAISE EXCEPTION '無效的 tier: %', p_tier;
  END IF;

  PERFORM 1 FROM public.schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '學校不存在';
  END IF;

  IF p_program_id IS NOT NULL THEN
    PERFORM 1 FROM public.school_programs
    WHERE id = p_program_id AND school_id = p_school_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '科系不屬於此學校';
    END IF;
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_next_order
  FROM public.school_list_items WHERE school_list_id = p_list_id;

  INSERT INTO public.school_list_items (
    school_list_id, school_id, program_id, program_name_override,
    tier, display_order, notes
  ) VALUES (
    p_list_id, p_school_id, p_program_id,
    NULLIF(trim(coalesce(p_program_name_override, '')), ''),
    p_tier,
    v_next_order,
    NULLIF(trim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_school_list_item(
  p_id UUID,
  p_tier TEXT,
  p_display_order INTEGER,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_locked BOOLEAN;
BEGIN
  SELECT sl.student_id, sl.is_locked INTO v_student_id, v_locked
  FROM public.school_list_items sli
  JOIN public.school_lists sl ON sl.id = sli.school_list_id
  WHERE sli.id = p_id;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '項目不存在';
  END IF;
  IF v_locked THEN
    RAISE EXCEPTION '此版本已鎖定,不可修改';
  END IF;

  PERFORM public._sl_authorize(v_student_id);

  IF p_tier NOT IN ('dream', 'match', 'safety') THEN
    RAISE EXCEPTION '無效的 tier: %', p_tier;
  END IF;

  UPDATE public.school_list_items SET
    tier = p_tier,
    display_order = COALESCE(p_display_order, display_order),
    notes = NULLIF(trim(coalesce(p_notes, '')), '')
  WHERE id = p_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
