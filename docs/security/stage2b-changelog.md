# Stage 2-B 修補紀錄 — 上傳內容嗅探 + CSV injection 防護

日期:2026-06-09
資安對應:§2.5(上傳僅驗 client MIME、CSV formula injection)。
範圍:上傳內容嗅探(6 個 action)、CSV injection 防護、選做的 `find_phone_anywhere` ORDER BY。
**不含** `select('*')` 最小揭露(留待 Stage 2-C,於 Stage 3 測試建立後再做)。未動 RLS / Storage 設定 / 金鑰。

---

## 摘要

| 任務 | 內容 | 狀態 |
|---|---|---|
| 前置 | `npm run gen:types` + 移除 `as never` | ⚠️ **環境無法執行**(缺 Supabase access token),待 Jo 處理 |
| 一 | 6 個 upload action 加入 magic-number 內容嗅探 | ✅ 完成 |
| 二 | CSV 匯出 formula/CSV injection 防護 | ✅ 完成 |
| 三(選做) | `find_phone_anywhere` 加確定性 ORDER BY | ✅ 已寫 migration `0046`(選做、待套用) |
| 加固 | 對抗式審查的 low 觀察(size 上限對齊 UI、註解修正) | ✅ 處理 |

---

## 前置:`gen:types` 與 `as never` —— 環境受限,待 Jo 處理

- `npm run gen:types` 在本工作環境**無法執行**:
  1. npm script 用裸 `supabase`(本機只有 `npx supabase` 可用,2.105.0);且 `>` 重導向會在指令失敗「之前」就把 `types/database.ts` 清空 → 已立即 `git checkout HEAD -- types/database.ts` **還原(1585 行完整無誤)**。
  2. 改用 `npx supabase gen types ...` 重試 → 失敗於 **`Access token not provided`**(本環境未 `supabase login`、無 `SUPABASE_ACCESS_TOKEN`)。
- 因此 **`as never` 轉型維持原狀**(在沒有重新產生的型別下移除會使 typecheck 失敗)。
- **待 Jo(具 Supabase 認證的環境)執行**:
  ```bash
  npx supabase login            # 或設 SUPABASE_ACCESS_TOKEN
  npm run gen:types             # 重新產生 types/database.ts(含 0045 的 find_* JSONB 簽名)
  ```
  之後可在 `app/(dashboard)/students/actions.ts` 的 `find_duplicate_student_by_phone` / `find_phone_anywhere` 兩處 `.rpc(... as never, ... as never)` 移除轉型。
- 小建議(非本次變更):`package.json` 的 `gen:types` 用裸 `supabase`,在未全域安裝的機器會失敗;可改為 `npx supabase ...` 或全域安裝。本次未改 `package.json` 的此行。

---

## 任務一:上傳檔案內容嗅探

**問題**:6 個 upload 只驗 `file.type`(MIME 由 client 提供、可偽造)。
**修正**:新增共用工具 [`lib/utils/file-validation.ts`](lib/utils/file-validation.ts) 的 `sniffUploadedFile(file, { allowed, maxBytes })`:
1. 非空 `File` 檢查;
2. `file.size ≤ maxBytes`;
3. 讀 buffer,用 **`file-type`(magic number)** 嗅探真實型別,只放行白名單;
4. 回傳偵測到的**真實 mime**,呼叫端以此當 Storage `contentType`(不信任 client 宣告)。
- `file-type@22`(純 ESM)以**動態 import** 載入,相容 Next.js server 環境;檔案 `import 'server-only'` 鎖定不進 client bundle。
- 各 action 保留原本的 `file.type` 檢查當「便宜的第一道關卡」,內容嗅探為最終權威。

### 6 個 upload 邏輯動作 × 白名單 × 大小上限

| # | Action(檔案) | Bucket | 真實型別白名單 | 大小上限 | UI accept(對齊) |
|---|---|---|---|---|---|
| 1 | `uploadUatScreenshot`（uat/actions.ts） | uat-screenshots | PNG / JPEG / WebP | 5MB | `image/*`(server 更窄,正確) |
| 2 | `createDefer`（students/[id]/defer/actions.ts） | student-defer-agreements | PDF | 10MB | `application/pdf` |
| 3 | `uploadCertificate`（students/[id]/scores/actions.ts;`createScore`+`updateScore` 共用) | student-certificates | PDF / PNG / JPEG / WebP | 10MB | `image/png,image/jpeg,image/webp,application/pdf` |
| 4 | `uploadRequiredDocument`（students/[id]/required-documents/actions.ts） | student-required-documents | PDF / PNG / JPEG / WebP | 10MB | `application/pdf,image/png,image/jpeg,image/webp` |
| 5 | `uploadPdf`→decisions（students/[id]/applications/actions.ts;`uploadDecisionFile`) | application-decisions | PDF | 10MB | `application/pdf` |
| 6 | `uploadPdf`→scholarships（同檔;`upsertScholarship`) | application-scholarships | PDF | 10MB | `application/pdf` |

> #3 與 #5/#6 各自共用一個 helper(`uploadCertificate` / `uploadPdf`),嗅探放在 helper 內,涵蓋全部呼叫點。白名單一律**不寬於 UI accept**(uat 由 `image/*` 收窄為 PNG/JPEG/WebP,排除 SVG/GIF 等,方向更安全)。`contentType` 全部改用偵測到的 `sniff.mime`。

### 手動驗證(Node 實測,複製 helper 邏輯)
- ✅ 純文字 / EXE(`MZ` header)改名 `.pdf` → **拒絕**(偵測為 `undefined` / `application/x-msdownload`,不在白名單)。
- ✅ 真實 PNG 丟到「PDF-only」bucket(defer)→ **拒絕**(png 不在白名單)。
- ✅ 超過上限 / 空檔 → 拒絕。
- ✅ 正常 PDF / PNG / JPEG / WebP → 通過(`file-type` magic number 正確判定)。

---

## 任務二:CSV formula / CSV injection 防護

**問題**:CSV 匯出未中和公式注入(`= + - @`、Tab、CR 開頭可能被 Excel/Sheets 當公式執行)。
**修正**:新增 [`lib/utils/csv.ts`](lib/utils/csv.ts) 的 `csvCell(value)`:
1. **先** formula 中和:首字元為 `= + - @ \t \r` → 前置單引號 `'`(刻意檢查原始首字元、不 trim,才能同時擋以 Tab/CR 開頭的儲存格);
2. **再** 標準 CSV escaping:含 `, " \n \r` → 雙引號包覆、內部雙引號加倍。

### 涵蓋的匯出路徑
- 全 repo grep(`csv` / `text/csv` / `new Blob` / `join(',')` / `Content-Disposition` / xlsx / tsv)確認:**唯一**產生 CSV 的路徑是 [`app/(dashboard)/uat/admin/actions.ts`](app/(dashboard)/uat/admin/actions.ts) 的 `exportUatCsv`(其餘 components 的「download」皆為 Storage signed-URL 檔案下載,非表格匯出)。
- `exportUatCsv` 內 `const escape = csvCell`,**表頭列 + 每列每格**(9 欄,含 note / 姓名 / signed URL / 時間)皆經過 `csvCell`。匯出前另有 admin-only role check。

### 手動驗證
- ✅ `=1+1`→`'=1+1`、`@SUM(A1)`→`'@SUM(A1)`、`-2+3`→`'-2+3`、`+1`→`'+1`、Tab/CR 開頭皆中和。
- ✅ `=cmd,"x"` → `"'=cmd,""x"""`(先中和、再引號包覆 + 內部雙引號加倍)。
- ✅ 一般值(如電話 `02 5580 2586`)維持原樣。

---

## 任務三(選做):`find_phone_anywhere` 確定性排序 — migration `0046`

- 寫入 [`supabase/migrations/0046_find_phone_anywhere_order_by.sql`](supabase/migrations/0046_find_phone_anywhere_order_by.sql):在 CTE 加 `ORDER BY created_at DESC, match_id`(投影 `sort_at` 供排序;輸出 JSON 鍵與 0045 **完全一致**,`sort_at` 不進輸出),並讓 `jsonb_agg(... ORDER BY ...)` 陣列順序也確定。
- 解決 Stage 2-A 觀察:manager 命中 >5 筆時回傳哪 5 筆非確定性(純 UX,非安全/PII;restricted 角色一律空 matches,不受影響)。
- **CREATE OR REPLACE**(簽名未變)→ **不需重跑 `gen:types`**。**選做**:不套用也不影響安全;套用方式同 0045(Supabase 套用 SQL)。

---

## 加固(對抗式審查的 low 觀察)

對抗式 3 鏡頭審查(sniff-bypass / csv-coverage / regression)結果見下;對其指出的 low 觀察處理如下:
1. **Size 上限對齊 UI**:原先文件類 server 上限設 20MB,但 UI 文案標示「最大 10MB」(score-form-sheet、application-detail-sheet、`file-upload-button` 預設 `maxMB=10`)。已將文件類 4 個 action 的 server 上限**改為 10MB** 以對齊使用者所見(uat 維持 5MB,本就一致)。
2. **`csvCell` 註解修正**:原註解寫「trim 後」,實作是檢查原始首字元(刻意,如此才擋得住 Tab/CR 開頭)。已更新註解與實作一致。
3. **(保留、非安全)** `uploadRequiredDocument` 的 `safeFilename` 仍以 client 檔名推副檔名(已被 `/\.(pdf|png|jpg|jpeg|webp)$/` 限制),但物件的 `contentType` 已是嗅探到的真實 mime(下載以此為準)。屬 storage key 的外觀層面、非安全問題,本次不改。

---

## 對抗式審查結果

| 鏡頭 | 判定 | 重點 |
|---|---|---|
| sniff-bypass | **pass** | 6 個邏輯動作全部在 upload 前嗅探、reject 真的擋住(早退)、contentType 用偵測 mime、size 上限齊備、白名單不寬於 UI、動態 import 可用且不進 client;無繞過路徑 |
| csv-coverage | **pass** | `exportUatCsv` 為全 repo 唯一 CSV 路徑;表頭+每格皆走 csvCell;中和→跳脫順序正確、字元集完整 |
| regression | **pass** | 合法上傳不被誤擋;白名單逐一對齊 UI accept;0046 輸出 schema/role 分流/fail-closed 與 0045 一致、ORDER BY 語法正確;typecheck 無 `any`/`unknown` 外洩 |

**confirmedCount = 0**(無經查證為真的非 low 問題)。上述 low 觀察已處理 / 記錄。

---

## 驗證

- ✅ `npm run typecheck`、`npm run lint`、`npm run build` 全數通過(加固後重跑亦通過)。
- ✅ 內容嗅探 & `csvCell` Node 實測(見各任務「手動驗證」)。
- ✅ `file-type@22.0.1` 動態 import 在 Node 執行期可用;`npm run build`(Next.js)成功打包,確認 ESM 套件相容。

---

## 部署待辦(Jo / DevOps)

1. **`gen:types`**(具 Supabase 認證的環境):`npx supabase login` → `npm run gen:types`;之後移除 `students/actions.ts` 兩處 find_* 的 `as never`。
2. **(選做)** 套用 `0046`(確定性排序;不影響安全,不需 gen:types)。
3. `npm install` 後確認 `file-type@^22.0.1` 已安裝(已加入 `package.json` dependencies)。

---

## 變更檔案清單

| 檔案 | 變更 |
|---|---|
| `lib/utils/file-validation.ts` | 新增 — `sniffUploadedFile`(magic-number 嗅探 + size + 白名單) |
| `lib/utils/csv.ts` | 新增 — `csvCell`(formula 中和 + CSV escaping) |
| `app/(dashboard)/uat/actions.ts` | uploadUatScreenshot 加嗅探,contentType/ext 用 sniff 結果 |
| `app/(dashboard)/students/[id]/defer/actions.ts` | createDefer 加嗅探(PDF,10MB) |
| `app/(dashboard)/students/[id]/scores/actions.ts` | uploadCertificate 加嗅探(PDF/圖片,10MB) |
| `app/(dashboard)/students/[id]/required-documents/actions.ts` | uploadRequiredDocument 加嗅探(PDF/圖片,10MB) |
| `app/(dashboard)/students/[id]/applications/actions.ts` | uploadPdf(decisions+scholarships)加嗅探(PDF,10MB) |
| `app/(dashboard)/uat/admin/actions.ts` | CSV escape 改走 `csvCell`(formula 中和) |
| `supabase/migrations/0046_find_phone_anywhere_order_by.sql` | 新增 — 選做的確定性 ORDER BY |
| `package.json` / `package-lock.json` | 新增相依 `file-type@^22.0.1` |
| `docs/security/stage2b-changelog.md` | 本紀錄 |

> 註:本次未動 `types/database.ts`(`gen:types` 受環境所限,已還原回 HEAD)。
