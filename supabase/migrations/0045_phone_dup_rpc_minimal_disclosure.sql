-- ============================================================================
-- 0045 — 電話反查 RPC 最小揭露(Stage 2-A / 資安 §2.5,A 方案)
-- ============================================================================
--
-- 背景:`find_duplicate_student_by_phone`(0038)與 `find_phone_anywhere`
-- (0041)為 SECURITY DEFINER,刻意繞 RLS 做「跨全庫查重」。原本對「任何登入
-- 顧問」都回傳重複學生的姓名 + 承辦顧問,等於可用電話跨顧問列舉他人學生。
--
-- 決策(A 最小揭露):
--   * consultant(及其他/未知角色):偵測到重複時只回
--       { is_duplicate, matches: [], message: '此聯繫方式已存在,請聯繫管理員或主管' }
--     ——不回傳姓名 / 承辦顧問 / 學生 ID / 任何可識別資訊。
--   * manager_frontend / manager_backend / admin:維持回傳完整 matches。
--
-- 不變量:
--   1. 「是否重複」(is_duplicate)對所有角色一律以「跨全庫、繞 RLS」查得,
--      不因角色分流而漏判 —— 否則 createStudent 的防重會失效。
--   2. 分流在 function 內(DB 層)。前端拿不到 PII,network response 也沒有。
--   3. v_full 以 COALESCE 收斂為布林:角色為 NULL(查無 profile)時 fail-closed
--      → 視為「非完整揭露」(restricted),絕不誤判為 manager。
--   4. 維持 SECURITY DEFINER + SET search_path = public + 僅 authenticated 可執行。
--
-- 回傳型別由 RETURNS TABLE 改為 RETURNS JSONB,故先 DROP 再 CREATE
-- (Postgres 不允許 CREATE OR REPLACE 改變回傳型別)。DROP 會一併移除舊
-- GRANT,下方重新授權。套用後請執行 `npm run gen:types` 更新型別。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- §2A — find_duplicate_student_by_phone(p_phone) → JSONB
--   manager/admin : { is_duplicate, matches: [ { id, full_name, english_name,
--                     created_at, frontend_consultant_id, frontend_consultant_name } ] }
--   consultant    : { is_duplicate, matches: [], message }
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.find_duplicate_student_by_phone(TEXT);

CREATE OR REPLACE FUNCTION public.find_duplicate_student_by_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_role  user_role;
  v_full  BOOLEAN;
  v_match RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '未登入' USING ERRCODE = '42501';
  END IF;

  -- 取目前使用者角色;fail-closed:NULL(查無 profile)→ FALSE(restricted)。
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  v_full := COALESCE(v_role IN ('manager_frontend', 'manager_backend', 'admin'), FALSE);

  -- 正規化(與前端 normalizePhone 對齊):trim + 去空白/破折號。
  v_phone := regexp_replace(trim(coalesce(p_phone, '')), '[\s-]+', '', 'g');
  IF v_phone = '' OR length(v_phone) < 8 THEN
    RETURN jsonb_build_object('is_duplicate', false, 'matches', '[]'::jsonb);
  END IF;

  -- 不變量 #1:查重對所有角色一律跨全庫(繞 RLS),回最多 1 筆。
  SELECT
    s.id,
    s.full_name,
    s.english_name,
    s.created_at,
    s.frontend_consultant_id,
    COALESCE(p.display_name, p.full_name) AS frontend_consultant_name
  INTO v_match
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.frontend_consultant_id
  WHERE s.phone = v_phone
    AND s.deleted_at IS NULL
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_duplicate', false, 'matches', '[]'::jsonb);
  END IF;

  -- 最小揭露:非 manager/admin 一律只回布林 + 固定訊息,matches 必為空。
  IF NOT v_full THEN
    RETURN jsonb_build_object(
      'is_duplicate', true,
      'matches', '[]'::jsonb,
      'message', '此聯繫方式已存在,請聯繫管理員或主管'
    );
  END IF;

  -- manager / admin:完整資訊以利協調。
  RETURN jsonb_build_object(
    'is_duplicate', true,
    'matches', jsonb_build_array(
      jsonb_build_object(
        'id',                       v_match.id,
        'full_name',                v_match.full_name,
        'english_name',             v_match.english_name,
        'created_at',               v_match.created_at,
        'frontend_consultant_id',   v_match.frontend_consultant_id,
        'frontend_consultant_name', v_match.frontend_consultant_name
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_duplicate_student_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_student_by_phone(TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- §3 — find_phone_anywhere(p_phone) → JSONB
--   manager/admin : { is_duplicate, matches: [ { match_type, match_id,
--                     student_id, student_name, contact_name, contact_relation }, … ≤5 ] }
--   consultant    : { is_duplicate, matches: [], message }
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.find_phone_anywhere(TEXT);

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

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  v_full := COALESCE(v_role IN ('manager_frontend', 'manager_backend', 'admin'), FALSE);

  v_phone := regexp_replace(trim(coalesce(p_phone, '')), '[\s-]+', '', 'g');
  IF v_phone = '' OR length(v_phone) < 8 THEN
    RETURN jsonb_build_object('is_duplicate', false, 'matches', '[]'::jsonb);
  END IF;

  -- 不變量 #1:對所有角色一律掃 students + student_contacts(繞 RLS),上限 5 筆。
  WITH hits AS (
    SELECT
      'student'::TEXT AS match_type,
      s.id            AS match_id,
      s.id            AS student_id,
      s.full_name     AS student_name,
      NULL::TEXT      AS contact_name,
      NULL::TEXT      AS contact_relation
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
      c.relation
    FROM public.student_contacts c
    JOIN public.students s2 ON s2.id = c.student_id
    WHERE c.phone = v_phone
      AND s2.deleted_at IS NULL
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
      )),
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
