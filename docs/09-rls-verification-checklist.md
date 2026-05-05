# 09. RLS 權限驗證清單

> Phase 1.9 產出。Phase 1 完成後必須跑過一遍此清單,確認 RLS 隔離有效。
> 之後每次新增表 / policy / SECURITY DEFINER 函式,都要回到此清單擴充 + 重跑。

---

## 為什麼需要這份清單

本系統的權限**單一真相來源是 Supabase RLS**(見 [05-rls-policies.md](./05-rls-policies.md))。但因 Phase 0/1 過程中發現 Supabase 在某些 `WITH CHECK` 評估 context 下對 `is_manager_or_admin()` helper function 行為不穩(見 [migration 0004](../supabase/migrations/0004_security_definer_soft_delete.sql) 註解),我們改採 **SECURITY DEFINER 函式**處理特定 mutations。RLS 仍是 SELECT 與大多寫入路徑的權限機制 —— 但 SECURITY DEFINER 函式的權限邏輯是 plpgsql 內部 handcoded 的,**手動測試是唯一保證**。

---

## 測試帳號準備

到 Supabase Dashboard → Authentication → Users 建立 4 個測試帳號(全部 Auto Confirm User),然後到 SQL Editor 跑 `INSERT INTO public.profiles ...` 把 role 設好:

| email | role | department |
|---|---|---|
| `consultant_a@test.example` | `consultant` | `frontend` |
| `consultant_b@test.example` | `consultant` | `backend` |
| `manager_f@test.example` | `manager_frontend` | `frontend` |
| `admin_main@test.example` | `admin` | NULL |

範例 INSERT(替換 `<USER_UID>`):

```sql
INSERT INTO public.profiles (id, email, full_name, role, department, is_active)
VALUES
  ('<UID_A>', 'consultant_a@test.example', '顧問 A', 'consultant', 'frontend', TRUE),
  ('<UID_B>', 'consultant_b@test.example', '顧問 B', 'consultant', 'backend', TRUE),
  ('<UID_M>', 'manager_f@test.example', '前端主管', 'manager_frontend', 'frontend', TRUE),
  ('<UID_ADM>', 'admin_main@test.example', '老闆', 'admin', NULL, TRUE);
```

> ⚠️ 建議用真實 Email 收驗證信(Supabase 預設要驗證);或在 Auth → Providers → Email 把「Confirm email」關掉(僅 dev 環境)。

---

## A. 學生隔離

### A1 顧問 A 看不到顧問 B 的學生
1. 用 `consultant_a` 登入 → 新增學生「Alice」(會自動指派 A 為前端顧問)
2. 登出,改用 `consultant_b` 登入
3. 訪問 `/students` → ❑ Alice **不應**出現
4. 直接訪問 `/students/<Alice id>` → ❑ 應收到 404 或「找不到學生」

**為什麼能擋住**:`students_select` RLS USING `deleted_at IS NULL AND (is_manager_or_admin() OR FE/BE = auth.uid())`。對 consultant_b 而言 helper 為 false 且 FE/BE 都不是他 → row 看不見。

### A2 主管可看全部
1. 用 `manager_f` 登入
2. 訪問 `/students` → ❑ Alice 應出現
3. 訪問 `/students/<Alice id>` → ❑ 完整資料可見

### A3 顧問改不到別人的學生
1. 用 `consultant_b` 登入(沒有 Alice 的權限)
2. 在瀏覽器手動訪問 `/students/<Alice id>/edit` → ❑ 應 404 / 找不到學生
3. 或開 dev tools 模擬 form submit 直打 server action → ❑ `update_student` 函式應丟 `無權限編輯此學生`

### A4 顧問不能改派顧問身分
1. 用 `consultant_a` 登入(自己的學生 Alice)
2. 嘗試從 edit 介面把 frontend_consultant_id 換給 `consultant_b`
   - 顧問看不到「前端顧問 / 後端顧問」dropdown(`canPickConsultant = isManagerOrAdmin(role)`),所以前端 UI 已擋
   - 直接呼叫 `update_student` RPC 並換 ID → ❑ 函式應丟 `無權限變更顧問派發`

---

## B. 成交與績效

### B1 顧問 A 為自己學生建成交
1. `consultant_a` 登入,進 Alice → 成交分頁 → 建立成交
2. ❑ 應建立成功;狀態自動轉為「已成交」;字數帳本出現 `initial`
3. ❑ 時間軸出現「建立了成交」事件

### B2 顧問 B 看不到 A 的成交
1. `consultant_a` 建立成交後,登出
2. `consultant_b` 登入 → 列表搜不到 Alice → A 的 deal 自然看不到
3. 嘗試直接打 `supabase.from('deals').select('*').eq('id', '<Alice deal id>')` → ❑ 應回 0 rows(`deals_select` RLS 跟學生連動)

### B3 主管讀全部成交
1. `manager_f` 登入,進 Alice → 成交分頁
2. ❑ 應看到 A 建立的成交,含拆分明細

### B4 績效拆分總和強制 100%
1. 建成交時故意把 primary 改成 80%、referrer 開但沒設,送出
2. ❑ UI 應提示 `主拆分加總須為 100%(目前 80%)`,送不出
3. 開 dev tools 直接呼叫 `create_deal` RPC,p_splits 指定 primary 80% 而已 → ❑ 函式應丟 `主拆分總和必須等於 100%`

---

## C. 字數帳本

### C1 帳本只能 INSERT,不能 UPDATE/DELETE
1. 用任一帳號登入,執行
   ```js
   await supabase.from('word_quota_ledger')
     .update({ amount: 999 })
     .eq('id', '<existing ledger id>')
   ```
   ❑ 應失敗 / 0 rows(沒有 `UPDATE` policy)
2. 同樣對 DELETE 操作 → ❑ 應失敗

### C2 顧問 A 看自己學生的帳本
1. `consultant_a` 登入,讀 `word_quota_ledger.eq('student_id', Alice id)`
2. ❑ 應拿到至少一筆 `initial`(來自方案)

### C3 顧問 B 嘗試讀 A 學生的帳本
1. `consultant_b` 登入,同樣 query
2. ❑ 應回 0 rows(`ledger_select` 跟學生連動)

---

## D. 角色提升攻擊

### D1 自己改自己 role
1. `consultant_a` 登入,執行
   ```js
   await supabase.from('profiles')
     .update({ role: 'admin' })
     .eq('id', '<self uid>')
   ```
   ❑ 應失敗,訊息 `無權變更角色、部門或啟用狀態`(`fn_prevent_self_role_change` BEFORE UPDATE trigger 擋住)

### D2 顧問改別人的 profile
1. `consultant_a` 登入,執行
   ```js
   await supabase.from('profiles')
     .update({ display_name: 'hacked' })
     .eq('id', '<consultant_b uid>')
   ```
   ❑ 應失敗 / 0 rows(`profiles_update_self` USING `id = auth.uid()`,不是自己就被擋)

### D3 顧問建立 profile(注入新使用者)
1. `consultant_a` 登入,嘗試
   ```js
   await supabase.from('profiles').insert({
     id: '<random uuid>',
     email: 'fake@x.com',
     full_name: 'fake',
     role: 'admin',
   })
   ```
   ❑ 應失敗(`profiles_insert` WITH CHECK `id = auth.uid() OR is_admin()`,顧問不滿足)

---

## E. SECURITY DEFINER 函式權限

我們有 6 個 SD 函式,每個都應拒絕角色不符的呼叫者:

| 函式 | 限制 | 測試 |
|---|---|---|
| `soft_delete_student` | manager+/admin 可刪任何 / consultant 只能刪自己的 | 用 consultant_b 呼叫刪 A 的學生 → ❑ `無權限刪除此學生` |
| `change_student_status` | 同上 | consultant_b 換 A 學生狀態 → ❑ `無權限變更此學生狀態` |
| `update_student` | 同上 | consultant_b 改 A 學生 → ❑ `無權限編輯此學生` |
| `create_referrer` / `update_referrer` | manager+/admin 才能 | consultant_a 呼叫 → ❑ `無權限` |
| `create_service_plan` / `update_service_plan` | **僅 admin** | manager_f 呼叫 → ❑ `僅 admin 可管理服務方案` |
| `create_deal` | manager+/admin OR 該學生顧問 | consultant_b 為 A 的學生建成交 → ❑ `無權限為此學生建立成交` |

直接呼叫 RPC 的範例(在 dev tools console):
```js
const { error } = await supabase.rpc('soft_delete_student', { p_id: '<some id>' })
console.log(error)
```

---

## F. 軟刪除

### F1 顧問可軟刪除自己學生(目前 UI 不開放)
- UI:刪除按鈕僅 manager+/admin 可見
- DB:`soft_delete_student` 函式允許 consultant 刪自己的(對齊 RLS spec)
- 結論:UI 與 DB 寬度不一致是有意的 —— UI 收緊,DB 寬鬆作為彈性

### F2 軟刪除後該學生在列表消失
1. admin 登入,刪除 Alice
2. ❑ /students 列表不再出現 Alice
3. ❑ /students/<Alice id> 訪問應 404

### F3 軟刪除後相關 deals / ledger / activity_log 仍存在
1. SQL Editor 跑:
   ```sql
   SELECT count(*) FROM public.deals WHERE student_id = '<Alice id>';
   SELECT count(*) FROM public.word_quota_ledger WHERE student_id = '<Alice id>';
   SELECT count(*) FROM public.activity_log WHERE student_id = '<Alice id>';
   ```
   ❑ 三個都應 > 0(歷史保留)
2. 但是用 RLS context(透過 supabase-js)讀 deals → ❑ consultant 應讀不到(因為學生不在 students_select 範圍)

### F4 不允許 hard delete
1. `consultant_a` 嘗試
   ```js
   await supabase.from('students').delete().eq('id', '<Alice id>')
   ```
   ❑ 應失敗 / 0 rows(沒有 `DELETE` policy)

---

## G. 顧問交接紀錄

### G1 主管派遣後端顧問會留紀錄
1. admin 把 Alice 的 backend_consultant_id 從 NULL 改為 consultant_b
2. SQL 驗證:
   ```sql
   SELECT * FROM public.consultant_handovers
   WHERE student_id = '<Alice id>'
   ORDER BY handed_at DESC;
   ```
   ❑ 最新一筆 `handover_type = 'frontend_to_backend'`, `from = NULL`, `to = consultant_b`

### G2 改派前端顧問會留紀錄
1. 把 Alice 從 consultant_a 換成 consultant_a' (假設另一個顧問)
2. ❑ handover_type = 'frontend_swap'

---

## 執行紀錄表

跑完一輪後在這裡打勾。發現的問題寫在「備註」欄。

| 區塊 | 完成 | 跑測者 | 日期 | 備註 |
|---|---|---|---|---|
| A 學生隔離 | ☐ | | | |
| B 成交 / 拆分 | ☐ | | | |
| C 字數帳本 | ☐ | | | |
| D 角色提升 | ☐ | | | |
| E SD 函式 | ☐ | | | |
| F 軟刪除 | ☐ | | | |
| G 顧問交接 | ☐ | | | |

---

## 追加項目區

未來新增 RLS / SD 函式時把測試案例加在這裡。
