-- ============================================================================
-- 0046 — find_phone_anywhere:加上確定性排序(選做,Stage 2-B 任務三)
-- ============================================================================
-- 背景:Stage 2-A 對抗式審查的低風險觀察 —— 0045 的 find_phone_anywhere 在
-- manager/admin 命中 >5 筆時,`LIMIT 5` 無 `ORDER BY`,回傳哪 5 筆為非確定性。
-- 這純屬 UX 非確定性(restricted 角色一律回空 matches,完全不受影響;也不涉及
-- 安全 / PII)。此 migration 加上 `ORDER BY created_at DESC, match_id`,讓「取最近
-- 5 筆」與陣列順序皆為確定性。
--
-- 僅變更函式內部排序;回傳型別 / 簽名 / 角色分流 / 最小揭露邏輯與 0045 完全
-- 一致(仍為 RETURNS JSONB),故用 CREATE OR REPLACE(無需 DROP)。**簽名未變,
-- 套用後不需重跑 `gen:types`。** 本 migration 為「選做」——不套用也不影響安全,
-- find_phone_anywhere 會維持 0045 的行為。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_phone_anywhere(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone   TEXT;
  v_role    user_role;
  v_full    BOOLEAN;
  v_matches JSONB;
  v_count   INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  -- fail-closed:查無 profile / NULL role → restricted(非 manager)。
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  v_full := COALESCE(v_role IN ('manager_frontend', 'manager_backend', 'admin'), FALSE);

  v_phone := regexp_replace(trim(coalesce(p_phone, '')), '[\s-]+', '', 'g');
  IF v_phone = '' OR length(v_phone) < 8 THEN
    RETURN jsonb_build_object('is_duplicate', false, 'matches', '[]'::jsonb);
  END IF;

  -- 不變量 #1:對所有角色一律掃 students + student_contacts(繞 RLS)。
  -- 唯一變更:以 created_at DESC 取最近 5 筆(確定性;tie-break 用 match_id)。
  WITH hits AS (
    SELECT
      'student'::TEXT AS match_type,
      s.id            AS match_id,
      s.id            AS student_id,
      s.full_name     AS student_name,
      NULL::TEXT      AS contact_name,
      NULL::TEXT      AS contact_relation,
      s.created_at    AS sort_at
    FROM public.students s
    WHERE s.phone = v_phone
      AND s.deleted_at IS NULL
    UNION ALL
    SELECT
      'contact'::TEXT,
      c.id,
      c.student_id,
      s2.full_name,
      c.name,
      c.relation,
      c.created_at
    FROM public.student_contacts c
    JOIN public.students s2 ON s2.id = c.student_id
    WHERE c.phone = v_phone
      AND s2.deleted_at IS NULL
    ORDER BY sort_at DESC, match_id
    LIMIT 5
  )
  SELECT
    count(*),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'match_type',       match_type,
        'match_id',         match_id,
        'student_id',       student_id,
        'student_name',     student_name,
        'contact_name',     contact_name,
        'contact_relation', contact_relation
      ) ORDER BY sort_at DESC, match_id),
      '[]'::jsonb
    )
  INTO v_count, v_matches
  FROM hits;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('is_duplicate', false, 'matches', '[]'::jsonb);
  END IF;

  -- 最小揭露:非 manager/admin 只回布林 + 固定訊息,matches 必為空。
  IF NOT v_full THEN
    RETURN jsonb_build_object(
      'is_duplicate', true,
      'matches', '[]'::jsonb,
      'message', '此聯繫方式已存在,請聯繫管理員或主管'
    );
  END IF;

  RETURN jsonb_build_object('is_duplicate', true, 'matches', v_matches);
END;
$$;

REVOKE ALL ON FUNCTION public.find_phone_anywhere(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_phone_anywhere(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
