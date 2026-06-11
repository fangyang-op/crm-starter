# Stage 1-B — 跨角色 UAT 報告(Next.js 15 升級驗證)

日期:2026-06-10
分支:`chore/nextjs-15-upgrade`(Next.js 15.5.19 + React 19)
測試對象:**本機 dev server**,跑此分支的程式碼 + 連同一個 Supabase 專案(RLS/權限為 DB 層,結果與 Vercel preview 一致;Vercel-only 的部署環境差異建議另於 preview spot-check)。
結論:**0 FAIL,無 Next.js 15 升級造成的回歸。** 可作為 merge 到 main 的依據。

> 界線:本批僅新增帶 `uattest_` / 「測試學生_」標記的測試資料 + 讀取/操作驗證;未刪改既有資料、未動 RLS/Storage/金鑰/設定。清理 SQL 見文末(未自動執行刪除)。
> 註:本批為「Next.js 15 驗證」用途;移交文件 §9 要求的正式 5 組測試帳號由 Jo 另行建立。

---

## 1. 建立結果

**測試帳號**(統一密碼:`UatTest2026!`,皆 email_confirm)

| 角色 | role / department | email |
|---|---|---|
| Admin | `admin` / – | uattest_admin@example.com |
| 前端主管 | `manager_frontend` / frontend | uattest_fe_manager@example.com |
| 後端主管 | `manager_backend` / backend | uattest_be_manager@example.com |
| 前端顧問 | `consultant` / frontend | uattest_fe_consultant@example.com |
| 後端顧問 | `consultant` / backend | uattest_be_consultant@example.com |

> 修正:任務表寫「role=manager + department」,但實際 enum 是 `manager_frontend` / `manager_backend`(department 為另一欄位)。已照實際 schema 建立。

**假學生**(status=new_lead,lead_source=self_developed,全假值)

| 假學生 | 電話 | 前端顧問 | 後端顧問 |
|---|---|---|---|
| 測試學生_前端A | 0900000001 | 前端顧問(#4) | — |
| 測試學生_前端B | 0900000002 | 前端主管(#2,代表「別人的」) | — |
| 測試學生_後端A | 0900000003 | 前端顧問(#4) | 後端顧問(#5) |
| 測試學生_共用 | 0900000004 | 前端顧問(#4) | 後端顧問(#5) |

> 只有 1 個前端顧問,故「測試學生_前端B」指派給前端主管當「別的擁有者」,以證明前端顧問看不到非自己負責的學生。

---

## 2. 附錄 C.4 — RLS 隔離證明(10 條)

> 第 1/2/3/7/8 條以「各角色登入 anon client 直接查詢 Supabase」驗(DB 層,與 Next 版本無關);第 4/5/6/10 條以本機 dev server 實測。

| # | 測試情境 | 操作角色 | 預期結果 | 實測結果 | 判定 |
|---|---|---|---|---|---|
| 1 | 查詢其他前端顧問負責的學生 | 前端顧問 | 查不到 | 只見自己 3 筆(前端A/後端A/共用),**看不到前端B** | **PASS** |
| 2 | 直接以 ID 帶他人學生存取 | 前端顧問 | RLS 擋(空) | 前端B id → **0 筆**;自己的 id → 1 筆(對照) | **PASS** |
| 3 | 存取未指派給自己的學生 | 後端顧問 | 查不到 | 只見 be 指派的 2 筆(後端A/共用),看不到前端A/B | **PASS** |
| 4 | 進入 /settings | consultant | 被擋/redirect | redirect → / | **PASS** |
| 5 | 進入 /uat/admin | consultant | 被擋 | redirect → / | **PASS** |
| 6 | 進入 /duplicate-overrides | consultant | 被擋 | redirect → / | **PASS** |
| 7 | 查詢全部學生 | manager | 可查全部 | fe_manager / be_manager / admin **皆見全部 4 筆** | **PASS** |
| 8 | 電話反查回傳內容 | 前端顧問 | 僅「已存在」訊息,無姓名/承辦人 | `{is_duplicate:true, matches:[], message:"此聯繫方式已存在,請聯繫管理員或主管"}`;主管版回完整 matches(含 full_name) | **PASS** |
| 9 | 猜路徑下載 Storage 文件 | 未授權 | signed URL 短效、被擋 | **未現場測**(無上傳測試檔);Stage 0 已驗:6 bucket 全 Private、僅 `createSignedUrl(60)`、無 `getPublicUrl` | 設計已驗 |
| 10 | 重複偵測後嘗試「繼續建立」 | 前端顧問 | 無自助覆寫 | UI 顯示「此聯繫方式已存在」**無「繼續建立」鈕、無姓名**;server 端 Stage 2-A 已對抗式驗證:`createStudent` 拒絕顧問覆寫、fail-closed | **PASS** |

---

## 3. 任務四 — 升級後核心功能回歸

| # | 流程 | 預期 | 實測結果 | 判定 |
|---|---|---|---|---|
| A | 各角色登入 → 導向正確 | 正常、無 React 19 水合錯誤 | consultant / manager / admin 三角色登入皆成功落 `/`;sidebar 依角色正確(consultant 無「設定」);**無 console / 水合 error** | **PASS** |
| B | 前端顧問建檔(含重複偵測) | 正常 | `/students/new` 表單在 Next 15 渲染正常;重複手機 → 最小揭露提示、無覆寫鈕 | **PASS** |
| C | 成交 → 解鎖選校表/文件/申請 | 正常 | **未現場跑**(需先建成交);async server-action 模式已由 A/B 證實可用 | 未現場測 |
| D | 文件上傳(內容嗅探:改名假檔) | 假檔擋、正常檔過 | **未現場跑**;嗅探 Stage 2-B 已單元測(EXE/純文字改名 .pdf 被擋、真實 PDF/圖片過) | 未現場測(單元已驗) |
| E | 文件下載(signed URL) | 正常 | **未現場跑**;為 async server action + `createSignedUrl(60)` | 未現場測 |
| F | 申請追蹤、帳密頁讀寫 | 正常 | **未現場跑**;均 async createClient + RPC server action | 未現場測 |
| G | CSV 匯出(formula 中和) | 正常、formula 被中和 | **未現場跑**;`csvCell` Stage 2-B 已單元測(`=1+1`→`'=1+1` 等) | 未現場測(單元已驗) |
| H | 各受保護路由的跨角色存取 | 權限正確 | consultant 全擋;**manager**:/settings ✓、/duplicate-overrides ✓、/uat/admin 擋;**admin** 全通 —— 皆符合程式碼閘門 | **PASS** |
| + | 額外:`/students/[id]`(async params,13 並行查詢) | 渲染正常 | 以 admin 載入,顯示真實學生資料 + tabs,**無 error**(驗證 codemod 的 async params 改寫) | **PASS** |

### 跨角色路由保護總表(實測)

| 路由(程式碼閘門) | 前端顧問 | 前端主管 | Admin |
|---|---|---|---|
| /settings(`isManagerOrAdmin`) | 擋 ✓ | 通 ✓ | 通 ✓ |
| /uat/admin(`role==='admin'`) | 擋 ✓ | 擋 ✓ | 通 ✓ |
| /duplicate-overrides(`isManagerOrAdmin`) | 擋 ✓ | 通 ✓ | 通 ✓ |
| /(dashboard)、/students | 通 ✓ | 通 ✓ | 通 ✓ |

---

## 4. FAIL / 觀察

- **FAIL:0 件。** 無 Next.js 15 升級造成的回歸。
- **觀察(非 FAIL、非升級造成)**:`/settings` 實際閘門是 `isManagerOrAdmin`(主管 + Admin,見 `app/(dashboard)/settings/layout.tsx`),但移交文件 §6.2 寫「/settings admin-only」。屬**既有的文件/程式碼不一致**,請 Jo 裁示哪個才正確(文件寫錯,或程式碼過寬應收緊為 admin-only)。**與本次升級無關。**
- **覆蓋誠實聲明**:現場驗證集中在「升級最可能弄壞 + 安全關鍵」面(RLS 隔離、登入、路由保護、async-params 頁渲染、表單/server action)。較深的 CRUD 流程(C/D/E/F/G)未逐一現場點擊——以 build 通過 + 各前階段單元測 + 已證實可用的 async-server-action 模式佐證。建議 merge 前由 Jo 在實際 Vercel preview 上 spot-check 這幾項。

---

## 5. 清理用 SQL(給 Jo 日後清庫;本次未執行任何刪除)

於 Supabase SQL Editor 執行,精準刪除本批 `uattest_` 帳號 + 「測試學生_」假資料,不影響其他資料:

```sql
begin;
  -- 假學生子資料(students 的 ON DELETE CASCADE 子表會自動隨之清除)
  delete from public.activity_log
    where student_id in (select id from public.students where full_name like '測試學生\_%' escape '\');
  delete from public.student_contacts
    where student_id in (select id from public.students where full_name like '測試學生\_%' escape '\');
  -- 假學生本身
  delete from public.students where full_name like '測試學生\_%' escape '\';
  -- 測試帳號產生的稽核紀錄
  delete from public.activity_log
    where actor_id in (select id from public.profiles where email like 'uattest\_%' escape '\');
  -- 測試帳號(刪 auth.users 會 CASCADE 到 public.profiles)
  delete from auth.users where email like 'uattest\_%' escape '\';
commit;
```

---

## 6. 建議

1. 跨角色 RLS 隔離、權限路由、登入/角色導向、async request API 頁面渲染、建檔+重複偵測在 Next 15 上**全綠**;最小揭露(顧問無 PII)與顧問不可自助覆寫**仍生效** → **可作為 merge 依據**。
2. 更保險:merge 前在 Vercel preview 上補跑任務四 C/D/E/F/G。
3. 另記:`/settings` 閘門 vs 移交文件 §6.2 的不一致,請裁示。
