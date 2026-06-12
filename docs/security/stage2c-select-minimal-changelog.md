# Stage 2-C — `select('*')` 最小揭露(API response 欄位收斂)— 修補紀錄

日期:2026-06-12
分支:`fix/select-minimal-disclosure`(off `main` @ `34874fc`,即 Stage 3 測試套件已併入後的基底)
資訊部 §11 最後一個 P1:部分查詢用 `select('*')` 過度抓取,使 API response 含不必要(甚至敏感)欄位。本階段把所有 `select('*')` 收斂成**明確欄位清單**,只回傳該情境真正用到的欄位。

**範圍界線(嚴守)**:這是「收斂欄位(column projection)」,**不是改邏輯**。未動 RLS / Storage / 金鑰 / 資料 / 業務流程。RLS 限制的是「列」(哪些 row 看得到),本階段限制的是「欄」(每筆回傳哪些 column),兩者互補。

---

## 1. 方法:對抗式分析(不是憑感覺刪欄位)

收斂欄位的風險是「刪掉某個前端其實有用到的欄位 → 畫面壞掉」。為了**證明每一個被刪欄位都真的沒人用**,跑了一個 28-agent 的 workflow:

- **14 個分析 agent**(1 個 site 1 個):讀檔 → 從 `types/database.ts` 取該表完整欄位 → 追出**每一個 consumer**(JSX 渲染、解構、`.eq/.in/.order/.filter`、當 key/join、傳進子元件、`{...row}` spread、TS cast、序列化到瀏覽器)→ 提出最小欄位清單。
- **14 個對抗式驗證 agent**:拿到提案後**反過來嘗試推翻**——找出任何「被刪但其實有用到」的欄位;只要找到一個、或無法完整追蹤某 consumer,就判 `confirmed=false` 並補回。

**對抗式驗證實際抓到一個錯誤**(見下方 #14 帳密表):分析 agent 一度提議從學生詳情頁的 `student_credentials` 查詢中刪掉 `password_encrypted`,驗證 agent 推翻了它——該欄位被 `has_password: Boolean(c.password_encrypted)`(`students/[id]/page.tsx:171`)用來決定「是否顯示密碼/眼睛按鈕」,刪掉會讓密碼 UI 整個消失。最終**不動**該查詢。

收斂規則(逐 site 套用):
1. 保留 consumer 實際讀到的所有欄位 + 主鍵 `id`。
2. **保留查詢自身 `.order()` 用到的欄位**(留在 projection,不依賴 PostgREST「可排序未選取欄位」的行為,較保守)。
3. 保留 relation embed 原樣(如 `master:documents_master!inner(...)`、`plan:service_plans!inner(code, name)`)。
4. 不確定就保留——寧可保守(見各 site `risks`)。

---

## 2. grep 清單與逐一處置

`grep -rn "\.select\(\s*['\"\`]\*"` 全 repo(`app/ lib/ components/`)= **13 處** `select('*')`(無 bare `.select()`)。另加 1 處帳密表查詢(task #4 要求複查,雖非 `select('*')`)。

| # | 檔案:行 | 表 | 處置 | 移除的欄位 | 序列化到瀏覽器? |
|---|---|---|---|---|---|
| 1 | `settings/plans/page.tsx:34` | `service_plans` | 收斂 | `updated_at`(`created_at` 因 `.order()` 保留) | 是(→ PlanFormDialog) |
| 2 | `settings/referrers/page.tsx:25` | `referrers` | 收斂 | `updated_at` | 是(→ ReferrerFormDialog) |
| 3 | `students/[id]/edit/page.tsx:25` | `students`(PII) | 收斂 | `created_at, created_by, status_id, updated_at, deleted_at*` | 是(→ StudentForm initialValues) |
| 4 | `students/[id]/page.tsx:84` | `students`(PII) | 收斂 | `created_by, tags, updated_at` | 否(server 端渲染,只傳純量到子元件) |
| 5 | `…/variants/[variantId]/page.tsx:28` | `documents_variants` | 收斂 | `created_at, created_by, forked_from_master_version_id, is_finalized, updated_at` | 否 |
| 6 | `…/documents/[masterId]/page.tsx:35` | `documents_master` | 收斂 | `created_at, created_by, is_archived, student_id*, updated_at` | 否 |
| 7 | `schools/[id]/page.tsx:43` | `schools` | 收斂 | `created_at, updated_at` | 是(→ SchoolFormDialog) |
| 8 | `schools/[id]/page.tsx:51` | `school_programs` | 收斂 | `created_at, school_id*` | 是(→ ProgramFormDialog) |
| 9 | `student-timeline.tsx:12` | `activity_log` | 收斂 | **`entity_id, entity_type`** | **是(整列傳進 TimelineList)** |
| 10 | `student-schools.tsx:23` | `school_lists` | 收斂 | `created_by, notes, updated_at` | 否(server 端轉成 curated 物件) |
| 11 | `student-schools.tsx:57` | `school_list_items` | 收斂 | `created_at` | 否 |
| 12 | `student-deals.tsx:44` | `deals` | 收斂 | `created_at, created_by, updated_at` | 否(只傳 `existing` 明確物件) |
| 13 | `student-deals.tsx:147` | `deal_commission_splits` | 收斂 | `created_at` | 否 |
| 14 | `students/[id]/page.tsx:95` | `student_credentials` | **不動**(已是明確欄位 + 對抗式驗證確認最小) | — | 部分(`password_encrypted` 在 server 端被收斂成 `has_password` 布林,**密文本身不到瀏覽器**) |

`*` = 僅作為查詢 filter(`.eq/.is`)的參數、不從回傳列讀取的欄位;PostgREST 在 server 端套用 WHERE 不需要把它放進 projection,故未選取(`deleted_at`、`students` filter;`student_id`/`school_id` join filter)。

---

## 3. 誠實聲明:這次移除的「不是 PII」

把每張表的 consumer 追完後的事實:**PII 欄位幾乎全都有被用到**(姓名、Email、電話、生日、成績、轉介人聯絡方式——都被渲染或被編輯表單綁定),所以**它們不能刪**,留在 projection 是正確的。

真正被收斂掉的是:**稽核中介欄位**(`created_at`/`created_by`/`updated_at`)、**FK uuid**(`student_id`/`school_id`/`forked_from_master_version_id`)、**布林/狀態**(`is_finalized`/`is_archived`/`status_id`/`tags`)、以及 `activity_log` 的 `entity_type`/`entity_id`。

因此這次的揭露面縮減主要是:
1. **`activity_log`(#9)**:整列被序列化進 `'use client'` 的 `TimelineList`,故移除 `entity_type`/`entity_id` 是**真正減少送到瀏覽器的資料**。`payload`(jsonb)因 `formatActivity` 需要而保留——提醒:稽核 logger 寫進 `payload` 的內容會曝露在 client 端。
2. **傳進 client 元件的列(#1/#2/#7/#8)**:`service_plans`/`referrers`/`schools`/`school_programs` 的編輯 dialog 現在收到較少欄位。
3. **縱深防禦**:其餘(#4/#5/#6/#10/#11/#12/#13)縮減 Supabase→Next server 的回傳量(較少資料在傳輸/server 記憶體/日誌中),即使不直接到瀏覽器。

> 結論不為了收斂而收斂:沒有發現「未使用卻被外送的 PII 欄位」。最大的單點價值是 `activity_log` 的 client 序列化縮減。

---

## 4. 帳密表(task #4)複查結論

`students/[id]/page.tsx:95` 的 `student_credentials` 查詢已是**明確 7 欄**(`id, credential_type, label, url, account, password_encrypted, notes`),非 `select('*')`。複查資料流:

- `password_encrypted`(AES-256-GCM 密文)在 server 端**只被用來算 `has_password` 布林**(`:171`),**密文本身從未被放進傳給瀏覽器的 `CredentialItem`**。
- 明文密碼只在使用者點「眼睛/複製」時,由專用 server action `revealCredentialPassword`(`credentials/actions.ts`)**依 id 重新抓取並解密**——按需、有 `portal_password_revealed` 稽核。

→ **不動**。對抗式驗證確認刪 `password_encrypted` 會破壞 `has_password` 偵測(密碼 UI 消失)。
→ 可選的未來強化(**本階段不做**,因屬 schema/邏輯變更,超出「收斂欄位」範圍):新增一個 generated boolean 欄(`password_encrypted IS NOT NULL`)或經 RPC 回傳,讓頁面載入時連密文都不必抓。已記錄,待後續評估。

---

## 5. 一處必要的型別變更(非邏輯變更)

`activity_log`(#9)整列會流進 `TimelineList`(`'use client'`),其 prop 原本型別是完整的 `activity_log` Row。收斂查詢後回傳列不再含 `entity_*`,型別對不上,故在 `lib/activity-log.ts` 新增:

```ts
export type TimelineActivity = Pick<
  ActivityRow,
  'id' | 'action' | 'actor_id' | 'created_at' | 'description' | 'payload'
>
```

`formatActivity()` 的參數型別 `ActivityRow → TimelineActivity`(只讀 `action`/`payload`/`description`,完整 Row 仍可傳入,向後相容),`timeline-list.tsx` 的 `Props.activities` 同步改為 `TimelineActivity[]`。讓「最小揭露」的型別形狀從查詢一路貫穿到渲染。(`formatActivity` 僅被 `timeline-list.tsx` 使用,變更影響面已確認封閉。)

---

## 6. 新增測試(把最小揭露變成自動化證據)

`tests/integration/select-minimal-disclosure.integration.test.ts`(3 條,anon key + 登入後 session):

1. **`students` 詳情查詢**:用收斂後 projection 對 seeded 學生查詢,斷言**仍含**必要 PII(`full_name/email/phone/status_id/...`)、**不含** `created_by/tags/updated_at`。
2. **對照組 `select('*')`**:同一列用 `select('*')` 查,斷言 `created_by/tags/updated_at` **會出現**——證明這些欄位確實存在於表上,收斂後的缺席是「真的 projection 生效」而非欄位不存在。
3. **`activity_log` 時間軸查詢**:seed 一筆帶 `entity_type/entity_id` 的稽核列,用收斂後 projection 查,斷言**仍含** `action/payload`、**不含** `entity_type/entity_id`——直接證明送進瀏覽器 `TimelineList` 的 payload 不再帶這兩欄。

這些測試也是**防回歸**:若哪天有人把查詢改回 `select('*')`,被刪欄位重新出現,測試立刻紅。

> 測試基建修正:整合測試共用「固定身分 fixtures」(同 email / 學生名)對同一個真實 DB,本來就**不能平行跑**(兩個檔案的 `seedFixtures` 會搶建同一批 auth 使用者 → `Database error creating new user` / FK 違反)。已把 `test:integration` 加上 `--no-file-parallelism`,改為序列執行(單元測試仍平行,不受影響)。

---

## 7. 驗證結果(全綠)

| 檢查 | 結果 |
|---|---|
| `npm run typecheck` | ✅ 0 error(收斂後每個「直接存取」的欄位都仍在 projection,否則 tsc 會擋;cast 存取的 `status_id`/`lead_source_id`/`d.plan`/`variant.master`/`default_split_percent` 均為**保留**欄位,已逐一稽核) |
| `npm run lint` | ✅ No warnings/errors |
| `npm run build` | ✅ Compiled successfully(全路由建置通過) |
| `npm run test:unit` | ✅ 60/60 |
| `npm run test:integration` | ✅ **12/12**(9 RLS 既有 + 3 新最小揭露;對真實 Supabase seed→斷言→teardown,0 殘留) |
| `npm run test:e2e` | ✅ 4/4(CI prod-server 路徑;login + 路由保護未回歸) |

**學生詳細頁等「關鍵頁面」的執行期正確性**:由 typecheck(直接存取欄位齊全)+ 整合測試(收斂 projection 對真實 DB 回傳正確欄位)+ build 共同保證;cast 存取已人工稽核無誤刪。建議 Jo 在正式環境用真實資料做最後一次手動抽查(學生列表 / 詳細 / 申請 / 帳密頁),如 spec 所列。

---

## 8. 移交文件可更新

- **§2.3 / §11「`select('*')` 最小揭露」**:可標 ✅(13 處全收斂 + 帳密表複查;對抗式驗證 + 整合測試佐證)。
- **§5「API response 最小揭露尚未全面落實」**:可更新為「已落實:所有 `select('*')` 收斂為明確欄位;`activity_log` client 序列化縮減;帳密密文不外送瀏覽器(僅按需解密)。誠實註記:被移除者為稽核/中介欄位,未發現未使用卻外送的 PII 欄位」。
- **附錄 C.4 / 附錄 A 修補紀錄**:新增整合測試 `select-minimal-disclosure.integration.test.ts`(每次 CI 重跑的最小揭露證據 + 防回歸)。
