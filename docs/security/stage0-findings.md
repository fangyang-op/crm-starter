# Stage 0 資安現況盤點報告

產生日期：2026-06-04
盤點範圍：當前工作目錄全 repo（含 git history）+ supabase migrations，**唯讀診斷，未做任何修改**
盤點者：Claude Code（自動掃描）+ 待 Jo 人工確認項目（見下）

> 註：本報告為「現況盤點」，不含實際滲透測試。跨角色 RLS 實測（A 顧問登入查不到 B 顧問學員）依規劃留待 **Stage 3** 用測試帳號執行。

---

## 摘要：P0 風險清單（需立即處理）

| # | 風險 | 位置 | 一句話說明 |
|---|---|---|---|
| **P0-1** | **密碼產生器使用弱亂數 `Math.random()`** | `lib/validators/auth.ts:43-64` | 後台「建立使用者 / 重設密碼」的隨機密碼用 `Math.random()` 產生（非密碼學安全），且函式註解**謊稱**「Cryptographically-random / use crypto.getRandomValues」與實作不符。已被 `new-user-form.tsx` 與 `reset-password-card.tsx` 使用。 |

> 目前僅此一項 P0。其餘為 P1/P2/低（見下）。

---

## 摘要：需 Jo 手動確認清單

以下項目 Claude Code 無法從程式碼判斷，需在 Supabase Dashboard / 部署平台確認：

1. **Storage bucket 公開性**：以下 6 個 bucket 在 Dashboard → Storage 各別是 **Public 還是 Private**？（程式碼一律用短效 signed URL，但若 bucket 本身為 Public，等於 signed URL 形同虛設）
   - `uat-screenshots`、`student-defer-agreements`、`student-certificates`、`student-required-documents`、`application-decisions`、`application-scholarships`
2. **部署環境變數**：Vercel（或部署平台）確認 `SUPABASE_SERVICE_ROLE_KEY`、`ENCRYPTION_KEY` 僅存在於 server-side env，**未誤加 `NEXT_PUBLIC_` 前綴**、未進入 client bundle。
3. **遠端 git / 備份**：本地 git history 確認 `.env.local`（真實金鑰）**從未被提交**，但請確認任何遠端 fork、雲端備份、CI 紀錄中也沒有外洩。
4. **靜態原型未公開**：`docs/specs/referral-portal-v2.html`（含 Google Fonts 外部引用 + 內嵌假資料）確認**未被公開部署**到任何可存取的網址。
5. **Supabase Security Advisor**：到 Dashboard 的 Postgres「Security Advisor / Linter」查看是否有額外 lint 警告（例如未啟用 RLS 的表、未鎖 search_path 的 function）。
6. **signed URL 效期確認**：程式碼一律設 `createSignedUrl(path, 60)`（60 秒），確認此值符合營運需求，且 bucket 無設定更長的公開存取。
7. **跨角色實測**（Stage 3）：用測試帳號驗證 RLS 與 SECURITY DEFINER function 的實際可見性。

---

## 各任務詳細發現

### 任務一：Secret / Key 外洩 — 風險：低（現況良好）

**發現：**

- **`.env*` 是否曾進 git history？** → 只有 `.env.example`（佔位範本）在 commit `8b09a82 feat(phase-0): complete 0.1 project initialization` 被提交。
  - `.env.example` 內容為佔位字串 `SUPABASE_SERVICE_ROLE_KEY=eyJxxx...`，**非真實金鑰**。
  - 真實的 `.env.local` **從未進入版控**（`git log --all --full-history -- .env.local` 為空）。
- **`.gitignore` 排除規則**：✅ 正確排除 `.env`、`.env.local`、`.env.development.local`、`.env.test.local`、`.env.production.local`、`*.pem`。
- **明文 service_role key？** → 當前檔案與 git history diff 中**均無**真實 JWT（`eyJ...eyJ` 樣式）token，只有 docs 與 `.env.example` 的佔位/說明文字。
- **service role key 使用方式**：✅ 僅出現在 `lib/supabase/admin.ts`，且該檔案第 1 行為 `import 'server-only'`（Next.js 會在 client bundle 引用時直接 build fail）。實際 import 來源全為 server 端：
  - `app/(dashboard)/settings/users/actions.ts`（server action）
  - `app/(dashboard)/settings/users/page.tsx`（server component）
  - 未被任何 `'use client'` 檔案引用。
- **加密金鑰**：`lib/crypto.ts` 同樣 `import 'server-only'`，`ENCRYPTION_KEY` 由 `process.env`（無 `NEXT_PUBLIC_`）讀取，採 **AES-256-GCM**（IV 12 bytes + 128-bit auth tag），用於加密 portal/visa/housing 密碼。實作正確。

**風險判定**：**低**。金鑰衛生良好，無「key 曾進版控需輪替」的 P0。
**建議下一步**：完成上方手動確認 #2、#3 即可結案；不需輪替。

---

### 任務二：Supabase Storage 文件權限 — 風險：P2（上傳內容驗證不足）

**程式碼層面發現：**

- **下載方式**：✅ 全系統一律使用 `createSignedUrl(path, 60)`（60 秒短效簽署 URL），**完全沒有** `getPublicUrl`。
- **使用到的 bucket（共 6 個）**：
  | Bucket 名稱 | 用途 | 定義位置 |
  |---|---|---|
  | `uat-screenshots` | UAT 測試截圖 | `app/(dashboard)/uat/actions.ts:7` |
  | `student-defer-agreements` | 延遲入學同意書 | `app/(dashboard)/students/[id]/defer/actions.ts:7` |
  | `student-certificates` | 成績/證書 | `app/(dashboard)/students/[id]/scores/actions.ts:8` |
  | `student-required-documents` | 必備文件 | `app/(dashboard)/students/[id]/required-documents/actions.ts:7` |
  | `application-decisions` | 錄取/決定文件 | `app/(dashboard)/students/[id]/applications/actions.ts:267` |
  | `application-scholarships` | 獎學金文件 | `app/(dashboard)/students/[id]/applications/actions.ts:268` |

- **上傳內容驗證** → ⚠️ **僅檢查 `file.type`（瀏覽器回報的 MIME）與 `file.size`，未做實際內容嗅探（magic bytes）**：
  - `uat/actions.ts:72` → `if (!file.type.startsWith('image/'))`
  - `defer/actions.ts:27` 與 `applications/actions.ts:282` → `if (file.type !== 'application/pdf')`
  - `scores/actions.ts:61`、`required-documents/actions.ts:51` → `contentType: file.type`（直接信任 client 提供的 type，無型別白名單檢查）
  - `file.type` 由 client 控制，可被偽造；攻擊者可上傳偽裝 MIME 的檔案。因 bucket 為私有 + signed URL 短效 + 檔案不在 server 端執行，風險受限，但這些檔案會被其他顧問下載開啟。

**風險判定**：**P2**（上傳僅驗 MIME、未驗內容）。
**建議下一步**：(1) 在 server action 加入副檔名白名單 + magic-byte 嗅探（至少對 PDF 檢查 `%PDF` 標頭、對圖片檢查檔頭）；(2) 完成手動確認 #1（bucket 必須為 Private）。

---

### 任務三：弱亂數（PRNG）使用盤點 — 風險：P0

全 repo `Math.random` 僅出現在**同一個函式**（密碼產生器）：

| 檔案:行號 | 用途 | 風險等級 |
|---|---|---|
| `lib/validators/auth.ts:52` | 密碼必含字元（大寫）選取 | **P0** |
| `lib/validators/auth.ts:53` | 密碼必含字元（小寫）選取 | **P0** |
| `lib/validators/auth.ts:54` | 密碼必含字元（數字）選取 | **P0** |
| `lib/validators/auth.ts:56` | 密碼填充 9 字元 | **P0** |
| `lib/validators/auth.ts:60` | Fisher–Yates 洗牌索引 | **P0** |

**說明**：`generateRandomPassword()` 產生「後台一鍵帶入」的使用者初始密碼 / 重設密碼，被 `app/(dashboard)/settings/users/new/new-user-form.tsx:45` 與 `app/(dashboard)/settings/users/[id]/edit/reset-password-card.tsx:30` 使用。密碼屬於**安全敏感用途**，`Math.random()` 非密碼學安全 PRNG，理論上可被預測。

> ⚠️ 特別注意：函式註解寫「Cryptographically-random… use crypto.getRandomValues」，但**實作其實是 `Math.random()`**。註解與程式碼不符，容易誤導後續維護者。

**風險判定**：**P0**。
**建議下一步**：改用 `crypto.getRandomValues()`（瀏覽器/Node 皆可）做均勻取樣，並同步修正誤導性註解。其餘 UI/假資料用途的 `Math.random` — 本 repo **沒有**。

---

### 任務四：慢速 Regex（ReDoS，重點 phone normalize）— 風險：低（無 ReDoS）

- **巢狀量詞（`(a+)+`、`(.*)*` 等）** → 全 repo **未發現**任何此類 catastrophic-backtracking 樣式。
- **phone normalize（`lib/utils/phone.ts`）** 完整貼出：
  ```ts
  phone = phone.replace(/^\+8869/, '09')       // 線性、定錨
  phone = phone.replace(/^\+886/, '0')          // 線性、定錨
  phone = phone.replace(/\D/g, '')              // 線性 O(n)
  // 驗證：
  /^09\d{8}$/.test(normalized)                  // 定錨、固定長度
  /^0[2-9]\d{7,8}$/.test(normalized)            // 定錨、固定長度
  ```
  - 全為線性、無巢狀量詞 → **無 ReDoS**。
  - **長度上限保護**：`normalizePhone` 對輸入**無明確長度上限**，但因所有 regex 皆為線性 O(n)，即使超長字串也不會 catastrophic。DB 端對應 RPC（0038/0041）另有 `length(v_phone) < 8` 早退保護。
- 其他使用者可輸入欄位的 regex（email、日期）：
  - email `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`（`student.ts`、`referrer.ts`、`contacts/schema.ts`）— 常見樣式、無巢狀量詞，最壞情況仍接近線性 → 低風險。
  - 日期 `/^\d{4}-\d{2}-\d{2}$/`、數字輸入 `/^0+(\.0*)?$/` → 安全。

**風險判定**：**低**。無需緊急處理。
**建議下一步**：（可選）在 `normalizePhone` 入口加 `raw.slice(0, 32)` 之類的長度上限，作為縱深防禦。

---

### 任務五：Remote Artifacts（外部 CDN）integrity — 風險：低

**外部 CDN 引用清單（全 repo）：**

| 位置 | 引用 | 有 integrity？ |
|---|---|---|
| `docs/specs/referral-portal-v2.html:7` | `<link rel="preconnect" href="https://fonts.googleapis.com">` | 否 |
| `docs/specs/referral-portal-v2.html:8` | `<link href="https://fonts.googleapis.com/css2?...">`（Google Fonts CSS） | 否 |
| `docs/specs/referral-portal-v2.html:1038` | 內嵌 `<script>`（硬編碼假資料 demo） | n/a（inline） |

- **Sonar 標記的那 1 件** → 最可能是 **`docs/specs/referral-portal-v2.html:8` 的 Google Fonts `<link>` 無 `integrity`/`crossorigin`**。
- **重要背景**：此 HTML 是放在 `docs/specs/` 的**靜態原型/設計稿**，**不在 Next.js build/deploy 範圍**。實際應用程式（`app/`）的字型使用 `next/font/local`（**自架字型**，`app/layout.tsx:2`），**完全沒有任何外部 CDN 引用或外部 script**。
- 註：Google Fonts 動態 CSS 本質上無法套 SRI（內容會依瀏覽器變動），這是已知的低優先項目。

**風險判定**：**低**（原型檔，未部署）。
**建議下一步**：完成手動確認 #4（確保此原型 HTML 未公開部署）；正式 app 無此問題，無需改動。

---

### 任務六：RLS Policy 盤點 — 風險：低（含 P2 列舉觀察）

#### 6-1 / 6-2 資料表 × RLS 狀態

所有資料表（0001 init 22 張 + 後續 migration 新增）**皆已 `ENABLE ROW LEVEL SECURITY` 並至少有一條 policy**，**未發現「RLS 啟用但無任何 policy」的表**。

| 資料表 | 含個資 | RLS 啟用 | 主要 policy | 經 SECURITY DEFINER function 操作 |
|---|---|---|---|---|
| profiles | ✔（顧問姓名/角色） | ✔ | select / insert / update_self / update_admin | is_admin、admin_* |
| referrers | ✔（轉介人姓名/電話/email） | ✔ | select / write | create/update_referrer |
| **students** | ✔✔（姓名/email/phone/line/生日/備註） | ✔ | select / insert / update（0002 inline 修正） | soft_delete_student、change_student_status、find_*_phone |
| student_status_history | 部分 | ✔ | select（trigger 寫入） | fn_log_status_change |
| consultant_handovers | 部分 | ✔ | select / insert | update_student_and_handovers |
| service_plans / addon_pricing | ✘ | ✔ | select / write | plan_cud |
| deals | ✔（金額） | ✔ | select / insert / update | create_deal、update_deal |
| deal_commission_splits | ✔（拆分金額） | ✔ | select / write | create_deal |
| schools / school_programs | ✘ | ✔ | select / write | school_cud |
| school_lists / school_list_items | ✘ | ✔ | select / write / all | expand_school_list_to_applications |
| applications | ✔（**含 portal_password_encrypted**） | ✔ | select / write | application_cud、update_application_portal |
| documents_master(_versions) | 部分 | ✔ | all | documents_master_cud |
| documents_variants(_versions) | 部分 | ✔ | all | documents_variant_cud |
| word_quota_ledger | ✘ | ✔ | select / insert | fn_ledger_on_version_insert |
| academic_scores | 部分 | ✔ | all | academic_score_cud、score 0027 |
| commission_records | ✔（金額） | ✔ | select / write | commission 0021 |
| activity_log | ✔（操作紀錄） | ✔ | select / insert | （多 function 寫入） |
| lead_sources / lead_source_referrers | ✘ | ✔ | select | lead_source 0023 |
| student_statuses | ✘ | ✔ | select | — |
| application_scholarships | ✔（金額） | ✔ | select | applications 0029 |
| **student_credentials** | ✔✔（**visa/housing 加密帳密**） | ✔ | select（manager/admin 或承辦顧問） | create/update/delete_student_credential |
| student_defers | 部分 | ✔ | select | student_defers 0031 |
| document_templates / student_required_documents | 部分 | ✔ | select | required_documents 0032 |
| student_contacts | ✔（聯絡人姓名/電話） | ✔ | select / insert / update / delete | find_phone_anywhere |
| uat_chapters / uat_items / uat_results | 部分 | ✔ | read / own_* / admin_read | exportUatCsv |

#### SECURITY DEFINER function 重點審視

- **`search_path` 鎖定**：抽查所有讀過的 SECURITY DEFINER function（0001 的 `current_user_role`/`is_manager_or_admin`/`is_admin`/`is_student_consultant`/3 個 trigger、0004、0030、0038、0041 …）**皆有 `SET search_path = public`**（防 search_path 劫持）。naive 計數的「mismatch」全來自**註解中提到 SECURITY DEFINER** 的字串（如 0002 只含 policy + 說明註解、無 function），屬 false positive。→ 現況良好。**建議 Stage 1 對全部 function 做一次完整確認**（或用手動確認 #5 的 Supabase Linter 佐證）。
- **重點 function：**
  - `find_duplicate_student_by_phone(p_phone)`（0038）：`SECURITY DEFINER`、`REVOKE FROM PUBLIC` + `GRANT EXECUTE TO authenticated`，要求 `auth.uid()` 非空。**刻意繞過 RLS**以做跨顧問重複偵測，回傳 `id, full_name, english_name, created_at, frontend_consultant_id, frontend_consultant_name`（LIMIT 1）。
  - `find_phone_anywhere(p_phone)`（0041）：同上授權；查 `students` + `student_contacts`，回傳最多 5 筆 `student_name / contact_name / contact_relation`。
  - ⚠️ **列舉風險（P2）**：任一登入顧問可用任意電話號碼反查，得知「該電話對應的學生姓名 + 承辦顧問」即使該學生不屬於自己。屬 spec 設計（重複警示）但形同**跨租戶個資列舉管道**，可被腳本化批量探測。
  - `soft_delete_student`（0004）、`change_student_status`（0005）、`admin_*`（0024）、`*_credentials`（0030）等皆在函式內**自行做角色/承辦權限檢查**後才操作，模式正確。
  - `student_credentials`：密碼欄 `password_encrypted` 由 action 層先用 `lib/crypto.ts`（AES-256-GCM）加密才寫入，符合「敏感資料不可明文」規範。

#### 6-3 待 Stage 3

實際「A 顧問登入查不到 B 顧問學員」跨角色測試，留待 **Stage 3** 用測試帳號做。

**風險判定**：RLS 覆蓋與 SECURITY DEFINER 模式**整體良好（低）**；唯 `find_duplicate_student_by_phone` / `find_phone_anywhere` 的**跨顧問列舉**列為 **P2** 觀察。
**建議下一步**：(1) 對兩個 phone 反查 RPC 考慮加入呼叫頻率限制 / 審計記錄；(2) Stage 1 完成 SECURITY DEFINER `search_path` 全量確認。

---

### 任務七：npm 套件弱點 — 風險：P1（Next.js 叢集）

`npm audit` 原始輸出已存於 `docs/security/npm-audit-raw.json`。

- **總計**：**7 個（high 4、moderate 3、critical 0、low 0）**
- **High（4，皆與 Next.js 14.2.35 相關）**：
  | 套件 | 直接/間接 | 說明 |
  |---|---|---|
  | `next` | **直接** | 14 條 advisory：含 App Router CSP nonce **XSS**、WebSocket upgrade **SSRF**、Pages Router i18n **middleware bypass**、cache poisoning、多項 Image Optimizer / RSC **DoS** 等 |
  | `eslint-config-next` | **直接** | 連帶 advisory |
  | `@next/eslint-plugin-next` | 間接 | 連帶 |
  | `glob` | 間接 | 連帶 |
- **Moderate（3）**：
  | 套件 | 直接/間接 | 可否非破壞性修復 |
  | `postcss` (<8.5.10) | 間接（next 內） | 須隨 next 升級（破壞性） |
  | `ws` (8.0.0–8.20.0) | 間接 | ✅ **`npm audit fix` 即可（非破壞性）** |
  | `brace-expansion` | 間接 | ✅ `npm audit fix` 可解 |
- **可直接 `npm audit fix`（不需 breaking）**：`ws`、`brace-expansion`。
- **需 breaking change**：Next.js / postcss 叢集 → `npm audit fix --force` 會裝 `next@16.2.7`（**major，breaking**）。許多 advisory 為**條件式**（例如 i18n bypass 僅影響 Pages Router，本專案用 App Router；CSP nonce XSS 僅在使用 CSP nonce 時），但仍建議排程升級。

**風險判定**：Next.js 高危叢集 **P1**（含 XSS/SSRF/bypass，雖多為條件式）；`ws`/`brace-expansion` 低（易修）。
**建議下一步**：(1) 先 `npm audit fix` 解掉 `ws`、`brace-expansion`（非破壞性，可立即做）；(2) 另開排程評估 `next@14 → 最新 14.x 或 15/16` 的升級路徑與相容性測試（不在本唯讀階段執行）。

---

### 任務八：API Response 個資揭露快速掃描 — 風險：P2（最小揭露待審）

`.select('*')` 使用位置（需在 Stage 2 做「最小揭露」欄位精簡審查）：

| 位置 | 查詢的表 | 是否含個資 | Stage 2 審查 |
|---|---|---|---|
| `app/(dashboard)/students/[id]/page.tsx:83` | `students` | ✔✔（姓名/email/phone/line/生日/備註/tags） | **必審** |
| `app/(dashboard)/students/[id]/edit/page.tsx:24` | `students` | ✔✔ | **必審** |
| `app/(dashboard)/settings/referrers/page.tsx:25` | `referrers` | ✔（轉介人姓名/電話/email） | **必審** |
| `components/students/student-timeline.tsx:12` | `activity_log` | ✔（操作紀錄/payload） | 審（注意是否為 client component over-fetch） |
| `components/students/student-schools.tsx:23,57` | `school_lists` / `school_list_items` | ✘ | 低 |
| `components/students/student-deals.tsx:147` | `deal_commission_splits` | ✔（金額拆分） | 審 |
| `app/(dashboard)/settings/plans/page.tsx:34` | `service_plans` | ✘ | 低 |
| `app/(dashboard)/schools/[id]/page.tsx:42,50` | `schools` / `school_programs` | ✘ | 低 |
| `app/(dashboard)/students/[id]/documents/[masterId]/page.tsx:36` | `documents_master` | 部分 | 審 |

**補充（CSV 匯出）**：`app/(dashboard)/uat/admin/actions.ts` 的 `exportUatCsv()` 為 admin-only（server action 內再驗一次 role），signed URL 60 秒，整體良好；但 CSV escape（`actions.ts:66-70`）僅處理 `" , \n \r` 引號跳脫，**未防 formula/CSV injection**（以 `=`/`+`/`-`/`@` 開頭的 `note`/姓名欄位在 Excel 可能被當公式執行）→ **P2**。

> 注意：上述 `select *` 皆受 RLS 保護**列**層級（顧問只看到自己學生），主要風險是「**回傳超出畫面所需的欄位**」（over-fetch），以及若為 client component 會把多餘欄位送到瀏覽器。多數頁面為 server component（資料留在 server），需在 Stage 2 逐一確認 client/server 邊界。

**風險判定**：**P2**（最小揭露 + CSV injection）。
**建議下一步**：Stage 2 將上表「必審/審」項目改為明列欄位；CSV 匯出對儲存格做 formula-injection 前綴防護（如前置 `'`）。

---

## 建議的 Stage 1 修補順序

依風險與修復成本排序：

1. **【P0】修密碼產生器** `lib/validators/auth.ts` — 改 `Math.random()` → `crypto.getRandomValues()`，並修正誤導註解。**最高優先、改動小、無相依風險。**
2. **【低、立即可做】** `npm audit fix` 解 `ws` + `brace-expansion`（非破壞性）。
3. **【手動確認】** 完成「需 Jo 手動確認清單」#1（bucket Public/Private）、#2（部署 env 無 `NEXT_PUBLIC_` 外洩）、#5（Supabase Linter）。
4. **【P2】上傳內容驗證** — 在各 upload server action 加副檔名白名單 + magic-byte 嗅探。
5. **【P2】CSV formula-injection 防護** — `exportUatCsv` 儲存格前綴處理。
6. **【P2】phone 反查 RPC** — 評估頻率限制 / 審計，降低跨顧問列舉風險。
7. **【P2】最小揭露** — Stage 2 將 `select('*')` 改明列欄位（先做 students / referrers）。
8. **【P1、需排程】** Next.js 升級路徑評估（major、需完整相容性測試，不在 Stage 1 倉促進行）。

---

*（本報告由唯讀掃描產生，未對任何程式碼、設定、金鑰、RLS、bucket 做出修改。）*
