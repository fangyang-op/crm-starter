# 05. RLS 權限策略

> Row Level Security 是本系統權限控管的**單一真相來源**。  
> 所有表的權限規則都集中在此說明,migration SQL 同步實作。

---

## 核心原則

1. **預設關閉**:每張新表建立時必須立即 `ENABLE ROW LEVEL SECURITY`,否則拒絕 commit
2. **顧問只看自己**:一般顧問僅能讀寫自己負責的學生(及其衍生資料)
3. **主管全看**:前端/後端主管可讀寫**全部**學生
4. **Admin 全權**:老闆權限同主管 + 系統設定
5. **Service role 例外**:僅在 server-side 受信任的程式可使用,**永遠不暴露到前端**

---

## 角色判斷 Helper Functions

放在 `public` schema,每張表的 policy 都會用到。

```sql
-- 取得當前使用者角色
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- 是否為主管或以上
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role IN ('manager_frontend', 'manager_backend', 'admin')
  FROM profiles WHERE id = auth.uid()
$$;

-- 是否為 admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role = 'admin' FROM profiles WHERE id = auth.uid()
$$;

-- 是否為某學生的負責顧問(前端或後端)
CREATE OR REPLACE FUNCTION public.is_student_consultant(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND (frontend_consultant_id = auth.uid() OR backend_consultant_id = auth.uid())
  )
$$;
```

---

## 表權限總覽

| 表 | 讀 | 寫 |
|---|---|---|
| `profiles` | 自己 + 主管以上看全部 | 僅 admin / 自己只能改 display_name + avatar |
| `referrers` | 主管以上 | 主管以上 |
| `students` | 顧問看自己 / 主管以上看全部 | 顧問可改自己的 / 主管全部 |
| `student_status_history` | 跟隨 students | INSERT only(由 trigger) |
| `consultant_handovers` | 跟隨 students | 主管以上 |
| `service_plans` | 全部已驗證 | 僅 admin |
| `addon_pricing` | 全部已驗證 | 僅 admin |
| `deals` | 跟隨 students | 顧問可建自己的 / 主管全部 |
| `deal_commission_splits` | 跟隨 deals | 跟隨 deals |
| `schools` | 全部已驗證 | 主管以上 |
| `school_programs` | 全部已驗證 | 主管以上 |
| `school_lists` | 跟隨 students | 跟隨 students |
| `school_list_items` | 跟隨 school_lists | 跟隨 school_lists |
| `applications` | 跟隨 students | 跟隨 students |
| `documents_master` | 跟隨 students | 跟隨 students |
| `documents_master_versions` | 跟隨 documents_master | 跟隨 documents_master |
| `documents_variants` | 跟隨 documents_master | 跟隨 documents_master |
| `documents_variant_versions` | 跟隨 documents_variants | 跟隨 documents_variants |
| `word_quota_ledger` | 跟隨 students | INSERT only(server-side / trigger) |
| `academic_scores` | 跟隨 students | 跟隨 students |
| `commission_records` | 主管以上 | 主管以上 |
| `activity_log` | 跟隨 students | INSERT only(server-side) |

---

## 範例 Policy(挑幾個重點說明)

### students(核心)

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- SELECT:顧問看自己 / 主管全看 / 排除已刪除
CREATE POLICY students_select ON students
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      is_manager_or_admin()
      OR frontend_consultant_id = auth.uid()
      OR backend_consultant_id = auth.uid()
    )
  );

-- INSERT:任何已驗證使用者都可建學生(預設指派自己為前端)
CREATE POLICY students_insert ON students
  FOR INSERT TO authenticated
  WITH CHECK (
    -- 強制 created_by 是自己
    created_by = auth.uid()
    AND (
      -- 顧問只能把自己設為前端顧問
      is_manager_or_admin()
      OR frontend_consultant_id = auth.uid()
    )
  );

-- UPDATE:顧問改自己的 / 主管全部
CREATE POLICY students_update ON students
  FOR UPDATE TO authenticated
  USING (
    is_manager_or_admin()
    OR frontend_consultant_id = auth.uid()
    OR backend_consultant_id = auth.uid()
  )
  WITH CHECK (
    -- 改完後仍須有讀寫權限(防止顧問把自己踢掉後反而失去 update 權)
    is_manager_or_admin()
    OR frontend_consultant_id = auth.uid()
    OR backend_consultant_id = auth.uid()
  );

-- DELETE:不允許 hard delete(用 update deleted_at 取代)
-- 不建立 DELETE policy = 預設拒絕
```

### deals

```sql
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY deals_select ON deals
  FOR SELECT TO authenticated
  USING (
    is_manager_or_admin()
    OR is_student_consultant(student_id)
  );

CREATE POLICY deals_insert ON deals
  FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_admin()
    OR is_student_consultant(student_id)
  );

CREATE POLICY deals_update ON deals
  FOR UPDATE TO authenticated
  USING (
    is_manager_or_admin()
    OR is_student_consultant(student_id)
  );
```

### word_quota_ledger(只能 INSERT)

```sql
ALTER TABLE word_quota_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_select ON word_quota_ledger
  FOR SELECT TO authenticated
  USING (
    is_manager_or_admin()
    OR is_student_consultant(student_id)
  );

CREATE POLICY ledger_insert ON word_quota_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_admin()
    OR is_student_consultant(student_id)
  );

-- 不建 UPDATE / DELETE policy = 只能 append
```

### profiles(特殊)

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 全部已驗證使用者可看其他 profile 基本欄(顯示姓名/頭像用)
-- 但敏感欄位需另外控制(email 不在此公開)
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- 自己可改 display_name / avatar
-- 變更 role / department / is_active 須 admin
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin 可改任何人
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 防止使用者自己改 role / department(用 trigger)
CREATE OR REPLACE FUNCTION prevent_role_change_by_self()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id = auth.uid() AND NOT is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role 
       OR NEW.department IS DISTINCT FROM OLD.department
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION '無權變更角色或啟用狀態';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_profiles_prevent_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_change_by_self();
```

---

## 必跑的權限測試清單

每完成一個 Phase 就跑一次。建議建立 4 個測試帳號:

| 帳號 | 角色 | 部門 |
|---|---|---|
| `consultant_a@test.com` | consultant | frontend |
| `consultant_b@test.com` | consultant | backend |
| `manager_f@test.com` | manager_frontend | frontend |
| `admin@test.com` | admin | (null) |

### 學生隔離測試

- [ ] consultant_a 建立學生 S1(自己為前端顧問)
- [ ] 用 consultant_b 登入 → S1 不應出現在列表
- [ ] consultant_b 直接訪問 `/students/S1.id` → 應 404 或無權
- [ ] manager_f 登入 → S1 應出現
- [ ] consultant_b 嘗試 update S1 → 應失敗(RLS reject)

### 成交與績效

- [ ] consultant_a 為 S1 建立 deal → 成功
- [ ] consultant_b 嘗試讀 S1 的 deal → 失敗
- [ ] manager_f 讀 S1 的 deal → 成功

### 字數帳本

- [ ] consultant_a 修改 S1 的 SOP → ledger 自動寫入
- [ ] consultant_b 嘗試讀 S1 的 ledger → 失敗
- [ ] consultant_b 嘗試寫 S1 的 ledger(直接打 API)→ 失敗

### 角色提升攻擊

- [ ] consultant_a 嘗試 update 自己 `profiles.role = 'admin'` → 應失敗(trigger)
- [ ] consultant_a 嘗試 update consultant_b 的 profile → 應失敗(policy)

### Soft delete

- [ ] consultant_a 嘗試 DELETE 學生 → 應失敗(無 DELETE policy)
- [ ] consultant_a UPDATE `deleted_at = NOW()` → 成功
- [ ] 之後列表應看不到該學生

---

## 常見坑與規避

### 1. RLS 被無痛繞過 ── `service_role`

**問題**:用 `SUPABASE_SERVICE_ROLE_KEY` 建立的 client 會繞過所有 RLS。

**規避**:
- `service_role` 只能在 server-side 受信任的 server action / API route 使用
- **絕對不能**以 `NEXT_PUBLIC_*` 前綴暴露
- 使用情境僅限:cron job、admin 後台、信任的批次匯入

### 2. policy 沒檢查 WITH CHECK

**問題**:只檢查 `USING` 的話,使用者可以把自己有權的 row 改成自己無權的 row(然後就回不去了)。

**規避**:`UPDATE` policy 都同時寫 `USING` 與 `WITH CHECK`。

### 3. 子表 policy 漏寫

**問題**:像 `school_list_items` 不寫 RLS 的話,顧問可以透過直接查 `school_list_items` 看到別人學生的選校內容。

**規避**:每張子表都寫 RLS,以 EXISTS subquery 連回主表(或用 helper function)。

### 4. SECURITY DEFINER 函式

**問題**:helper function 設 `SECURITY DEFINER` 等於以函式 owner 身份執行,可能被濫用。

**規避**:
- 函式內絕對不要做 UPDATE/INSERT/DELETE
- 一律 `SET search_path = public`(避免 schema 注入)
- 函式內用 `auth.uid()` 確認當前使用者
- 只暴露 SELECT 用途的判斷函式

---

## 維護檢查表

每次新增表時:

- [ ] `ALTER TABLE xxx ENABLE ROW LEVEL SECURITY;`
- [ ] 寫 SELECT policy
- [ ] 寫 INSERT policy(若允許)
- [ ] 寫 UPDATE policy(若允許,記得 WITH CHECK)
- [ ] 評估是否需 DELETE policy(預設不寫 = 拒絕)
- [ ] 更新本文件「表權限總覽」
- [ ] 跑一遍角色測試
