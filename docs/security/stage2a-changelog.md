# Stage 2-A 修補紀錄 — 電話反查 RPC 最小揭露(A 方案)

日期:2026-06-09
資安對應:§2.5(電話反查跨顧問列舉個資)。決策:**A 最小揭露** + 任務三 **(i) 顧問不可自助覆寫**(均已定案,直接實作)。

---

## 摘要

| 任務 | 內容 | 狀態 |
|---|---|---|
| 一 | 兩支 SECURITY DEFINER RPC 依呼叫者角色分流回傳(DB 層) | ✅ 完成(migration `0045`) |
| 二 | 前端建檔流程依角色顯示完整資訊 / 通用訊息 | ✅ 完成(`student-form.tsx`) |
| 三 | **(i) 已定案**:consultant 不可自助覆寫;覆寫僅限 manager/admin + 記錄 | ✅ 完成(`createStudent` 伺服器端強制) |
| 加固 | 對抗式審查發現的 **fail-open** 改為 fail-closed | ✅ 完成 |

> 本次涉及的 `0045` migration 與 `actions.ts`/`student-form.tsx` 的部分改動,在本工作階段開始前即以 WIP 形式存在於工作目錄。我**審閱並驗證**了既有 WIP、**補上缺漏的伺服器端強制(任務三)**、修正對抗式審查發現的問題,並更新過時註解。下方逐項標注哪些為既有、哪些為本次新增。

---

## 任務一:RPC 回傳邏輯(依角色分流)— `supabase/migrations/0045_phone_dup_rpc_minimal_disclosure.sql`

### function 變更摘要
兩支 function 由 `RETURNS TABLE(...)` 改為 **`RETURNS JSONB`**(回傳型別改變,故先 `DROP FUNCTION IF EXISTS` 再 `CREATE`;DROP 會一併移除舊 GRANT,下方重新授權)。維持 `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`。

### role 取得方式(DB 層,fail-closed)
```sql
SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
v_full := COALESCE(v_role IN ('manager_frontend','manager_backend','admin'), FALSE);
```
- 未登入 → 先 `RAISE EXCEPTION '未登入'`(42501)。
- **fail-closed**:查無 profile / role 為 NULL → `v_role IN (...)` 求值為 NULL → `COALESCE(NULL, FALSE) = FALSE` → 視為「受限(restricted)」,**絕不誤判為 manager**。

### 不變量(經對抗式審查逐一確認)
1. **查重對所有角色一律執行**:students / student_contacts 的命中查詢與角色無關,**先算出命中、再依 `v_full` 決定是否回傳 PII**;`is_duplicate` 永遠反映真實命中 → 防重不因角色分流而漏判。
2. **分流在 DB 層**:network response 本身不含 PII,前端拿不到。
3. `find_phone_anywhere` 的 `LIMIT 5` 在 CTE 內、`count(*)` 在其外 → `is_duplicate (count>0)` 不會被 LIMIT 壓回 false。

### consultant / manager 回傳差異

| 情境 | consultant(及未知/NULL 角色) | manager_frontend / manager_backend / admin |
|---|---|---|
| 電話空/太短(<8) | `{ is_duplicate:false, matches:[] }` | 同左 |
| 查無重複 | `{ is_duplicate:false, matches:[] }` | 同左 |
| **偵測到重複** | `{ is_duplicate:true, matches:[], message:'此聯繫方式已存在,請聯繫管理員或主管' }` | `{ is_duplicate:true, matches:[ {完整欄位…} ] }` |

- `find_duplicate_student_by_phone` 完整 matches 欄位:`id, full_name, english_name, created_at, frontend_consultant_id, frontend_consultant_name`(與舊 0038 TABLE 欄位逐一對應)。
- `find_phone_anywhere` 完整 matches 欄位:`match_type, match_id, student_id, student_name, contact_name, contact_relation`(與舊 0041 一致,≤5 筆)。

> 此 migration 為**既有 WIP**,本次經 5 項子需求 + 對抗式審查(invariant 鏡頭 **pass**)逐項驗證,內容正確,未改動。

---

## 任務二:前端建檔流程對應 — `components/students/student-form.tsx`

- 主手機與代填人手機各自新增 `duplicateNotice` / `contactPhoneNotice` state:當 `is_duplicate=true` 但 `matches` 為空(= consultant)時,顯示後端回傳的 `message`,**不顯示任何學生資訊**。
- 新增 `RestrictedDuplicateNotice` 元件(通用提示,**不含姓名/承辦顧問/ID**)。
- 完整 PII 警示元件(`DuplicatePhoneAlert` / `ContactPhoneAlert`)**只在 manager/admin 拿到 `existingStudent` / `matches.length>0` 時掛載**;consultant 永遠走 `RestrictedDuplicateNotice`。前端隱藏有 DB 層「response 無 PII」撐腰,非單靠 UI。
- **本次改動**:更新兩處過時註解(「待 Jo 決定 i/ii」→ 反映 (i) 已定案、顧問不可自助覆寫)。

> 大部分為既有 WIP;本次主要驗證其與新 JSONB 合約及任務三(i)一致,並修正註解。

---

## 任務三【已定案 (i)】:伺服器端覆寫強制 — `app/(dashboard)/students/actions.ts`(本次核心新增)

**問題**:`createStudent` 原本只要帶 `duplicateOverride` 就跳過查重,**完全沒有角色檢查**。Server Action 等同公開 endpoint,**consultant 可偽造帶 override 的呼叫**直接建立重複名單(且看不到對方是誰)。0044 已移除 phone UNIQUE → 此擋點是唯一安全網。前端隱藏按鈕**不足以**防護。

**本次新增的伺服器端強制**:
1. 重新查呼叫者角色(fail-closed):
   ```ts
   const role = (me as { role?: UserRole } | null)?.role ?? null
   const canOverride = role ? isManagerOrAdmin(role) : false
   const effectiveOverride = canOverride ? (duplicateOverride ?? null) : null
   ```
   - 查無 profile/role → `canOverride=false`(與 DB 層同樣 fail-closed)。
2. **override 降級**:非 manager/admin 帶進來的 `duplicateOverride` 一律降級為 `null` → 強制走查重 → 命中即以 `DUPLICATE_PHONE` 擋下。consultant 即使偽造也無法覆寫。
3. **最小揭露錯誤訊息**:consultant 收「此聯繫方式已存在,請聯繫管理員或主管。」;manager/admin 收原訊息。兩者皆**不含可識別個資**。
4. **覆寫記錄僅在具權限時寫入**:`if (effectiveOverride)` 才寫 `activity_log(action='duplicate_phone_override')`,payload 含 `duplicate_of_student_id`、正規化 `phone`、`reason='confirmed_different_by_manager_or_admin'`、新增 `overridden_by_role`(供主管審查「誰以什麼權限覆寫」)。

### 關於「duplicate_overrides 表」
本系統**沒有獨立的 `duplicate_overrides` 資料表**。覆寫紀錄即 `activity_log` 中 `action='duplicate_phone_override'` 的列,由「重複名單覆蓋紀錄」頁(`app/(dashboard)/duplicate-overrides/page.tsx`)與儀表板 widget(`app/(dashboard)/page.tsx`)讀取。為避免重複造輪子與破壞既有頁面,**沿用此既有機制**(規格所稱「duplicate_overrides + activity_log」即指此覆寫紀錄)。該頁本身另有 `isManagerOrAdmin` 頁面層 + activity_log RLS 雙重把關。

---

## 額外加固:fail-closed(來自對抗式審查)

對抗式審查確認一個 **medium** 真實問題:`createStudent` 的查重擋點對 **RPC 失敗 fail-open** —— `checkPhoneDuplicate` 在 RPC 錯誤時回 `{ ok:false }`,而原判斷 `if (dup.ok && dup.isDuplicate)` 會在 `dup.ok===false` 時整段跳過、落到 INSERT,**靜默建立重複名單**(0044 後無 UNIQUE 兜底)。

**本次修正(fail-closed)**:
```ts
const dup = await checkPhoneDuplicate(phoneToStore)
if (!dup.ok) {
  return { ok: false, error: '重複檢查暫時無法執行,請稍後再試。' }   // 查詢失敗 → 拒絕建立
}
if (dup.isDuplicate) { /* DUPLICATE_PHONE 擋下 */ }
```
只有明確 `dup.ok && !dup.isDuplicate` 才放行 INSERT。RPC 未部署 / PostgREST schema 未 reload / 連線瞬斷時不再變成放水門。

> 註:override 路徑(manager/admin)走 `effectiveOverride` 直接跳過此區塊,不受影響——有意覆寫者不會被 fail-closed 擋。

---

## 對抗式審查結果摘要

4 個鏡頭並行審查(每個非 low 發現再經獨立 refute 查證):

| 鏡頭 | 判定 | 重點 |
|---|---|---|
| PII 外洩 | **pass** | 兩支 RPC 全部 return 分支、server action、前端、覆寫頁、儀表板皆無對 consultant 洩漏 PII |
| 覆寫繞過 | issues_found → **1 confirmed** | 偽造 override / fail-closed 角色 / 唯一建立路徑皆無漏洞;唯一真實問題=RPC 失敗 fail-open(已修) |
| 不變量/遷移正確性 | **pass** | DROP→CREATE、SECURITY DEFINER、search_path、GRANT、fail-closed COALESCE、欄位對齊、≤5 上限皆正確 |
| 回歸/相容性 | issues_found(均 low,refute 後 0 confirmed) | JSONB 型別轉換安全、無殘留舊 TABLE 假設、manager 流程完整、覆寫頁/widget key 對齊 |

- **確認並修復**:1 件(fail-open → fail-closed)。
- **已知低風險觀察(未修,非本次範圍)**:`find_phone_anywhere` 的 `LIMIT 5` 無 `ORDER BY` → 當 manager 命中 >5 筆時,看到的 5 筆**非確定性**。屬既有行為(舊 0041 即如此)、非安全/PII 問題(manager 本就有權看全部),留待後續視需要加 `ORDER BY`。

---

## 驗證

- ✅ `npm run typecheck`、`npm run lint`、`npm run build` 全數通過(fail-closed 修正後重跑亦通過)。
- ✅ 對抗式 PII / 覆寫 / 不變量 / 回歸四鏡頭審查(見上)。
- **對應移交文件附錄 C.4 測試案例 #8**(留待 Stage 3 用測試帳號實測):
  1. 以 **consultant** 測試帳號用「已存在的電話」建檔 → network response **不得**出現任何姓名 / 承辦顧問 / 學生ID / 聯絡人;畫面只顯示「此聯繫方式已存在,請聯繫管理員或主管」,**且無「繼續建立」按鈕**;直接送出/偽造 override 仍被 `DUPLICATE_PHONE` 擋下。
  2. 以 **manager/admin** 測試帳號觸發重複 → 可見完整重複資訊與「確認為不同學生繼續建立」流程;覆寫後於「重複名單覆蓋紀錄」頁可見該筆(含 `overridden_by_role`)。
  3. **防重未因分流失效**:不同顧問用同一電話建檔,仍須被偵測為重複並擋下。

---

## 部署待辦(Jo / DevOps)

1. 套用 `supabase/migrations/0045_phone_dup_rpc_minimal_disclosure.sql` 到 Supabase。
2. 套用後執行 `npm run gen:types` 更新 `types/database.ts`(目前 server actions 以 `as never` 轉型,故不阻斷 build;更新後可移除部分 cast)。
3. 確認 PostgREST schema 已 reload(migration 末有 `NOTIFY pgrst, 'reload schema'`)。
4. Stage 3 跨角色實測(上方 C.4 #8)。

---

## 變更檔案清單

| 檔案 | 變更 | 既有 WIP / 本次 |
|---|---|---|
| `supabase/migrations/0045_phone_dup_rpc_minimal_disclosure.sql` | 兩支 RPC → JSONB + 角色分流 + fail-closed | 既有(本次驗證,未改動) |
| `app/(dashboard)/students/actions.ts` | check 函式消費 JSONB(既有);**createStudent 角色強制 + override 降級 + 覆寫記錄 gating + fail-closed(本次新增)** | 混合 |
| `components/students/student-form.tsx` | 角色分流 UI + `RestrictedDuplicateNotice`(既有);**過時註解更新(本次)** | 混合 |
| `docs/security/stage2a-changelog.md` | 本紀錄 | 本次新增 |

---

## 任務三狀態

**(i) 已定案並完成實作**:consultant 不可自助覆寫(前端無按鈕 + 伺服器端 override 降級雙層);覆寫能力僅限 manager/admin,且寫入 `activity_log(action='duplicate_phone_override')`(誰 `actor_id` / 何時 `created_at` / 針對哪筆 `duplicate_of_student_id` / 以什麼角色 `overridden_by_role`)。
