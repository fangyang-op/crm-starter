# CRM 系統修改規格 v1

> **目的**:本文件為留學代辦 CRM 系統第一輪 UI/UX + 功能修正規格,作為 Phase 4.5+ 的單一執行依據。
>
> **執行原則**:
> 1. 每個小節為一個獨立 task,完成後 commit 一次
> 2. 涉及 DB schema 變動的,在 `supabase/migrations/` 建立新的 migration 檔
> 3. 不確定的決策(設計風格、文案)只取最保守的合理推論,並在 commit message 標註 `# ASSUMPTION:`
> 4. UI Reference 參考圖[後補],若該節有 `[UI REF: TBD]` 標記,先做基本實作,等 Reference 補上後再調整視覺
> 5. 所有變更須保持與既有 RLS / 觸發器邏輯相容
> 6. 完成後在每節末勾 `[x]`
>
> **重要**:採用「申請準備 Checklist 預設清單」與「執行順序建議」 Appendix C。
>
> **採納的調整**(2026-05-06 確認):
> - Section 2.10 後端 Portal:`student_credentials.application_id UUID NULL`,portal 必填學校、visa/housing 留空(學生層級)
> - 其餘 spec 內容照原 v1 執行

---

## 0. 全域修正

### 0.1 點擊 responsiveness
- **位置**:全站所有可點擊元素
- **問題**:點擊後等待時間久不夠即時
- **本輪做法**:**先記錄、暫不修改**(因為後續討論點擊有冷卻機制,需要先比較清楚冷卻邏輯是 client debounce 還是 server-side)
- **TODO 給 Claude Code**:
  - 在 `docs/known-issues.md` 開一個項目 `#0.1 點擊 responsiveness`,記錄目前所有冷卻邏輯的元件出現位置(grep `disabled` + `setTimeout` / `useTransition` / `isPending`)
  - 不修改程式,只整理清單
- **驗收**:`docs/known-issues.md` 出現此清單,後續另行處理
- [ ] 完成

### 0.2 數字欄位顯示 0 問題
- **位置**:全站所有 `<Input type="number">` 或數字欄位
  - 主要影響:成交金額、加購字數金額、申請費金額、學費金額、財務證明金額等
- **問題**:預設顯示 `0`,使用者輸入 `4000` 變 `04000`
- **修改內容**:
  1. 數字輸入元件統一改用自訂 `<NumberInput />`(放在 `components/ui/number-input.tsx`)
  2. 邏輯:
     - 預設值若為 `0`,**顯示為空字串(placeholder 寫 `0`)**,而不是顯示 `0`
     - 使用者開始輸入時,自動消除前導 0
     - 失焦(onBlur)時若為空字串,寫回 `0` 到 state(資料層仍是 `0`,UI 層顯示空)
  3. 既有用到 `<Input type="number">` 的地方統一替換
- **檔案範圍**(grep 後處理):
  ```
  app/**/components/**/*.tsx
  app/**/(*)/page.tsx
  app/**/(*)/edit/**/*.tsx
  ```
- **驗收**:
  - [x] 新建學生/成交時,金額欄位預設顯示為空,placeholder 為 `0`
  - [x] 輸入 `4000` 顯示 `4000`,不會出現 `04000`
  - [x] 表單送出時,空字串視為 `0`,不會 NaN
- [x] 完成 — `components/ui/number-input.tsx` + 全站 6 檔 17 處替換

### 0.3 移除數字欄位上下微調箭頭
- **位置**:同 0.2 所有數字欄位
- **修改內容**:
  - **建議實作方式**:`<NumberInput />` 內部用 `type="text"` + `inputMode="decimal"` + 自行驗證(用 zod 或 onChange 過濾非數字字元),完全避開瀏覽器原生 number 輸入帶來的箭頭問題
  - 若必須用 `type="number"`,加 CSS:
    ```css
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
    ```
- **驗收**:
  - [x] 所有金額/數字欄位不再顯示上下微調箭頭
  - [x] 手機鍵盤跳出數字鍵盤(`inputMode="numeric"` / `"decimal"`)
- [x] 完成 — NumberInput 用 `type="text"` + `inputMode`,不使用原生 number

### 0.4 修改密碼功能
- **位置**:**兩處都要做**
  - **A. 個人設定**:`app/(dashboard)/account/security/page.tsx`(任何登入者皆可改自己的)
  - **B. 設定後台 - 用戶管理**:`app/(dashboard)/settings/users/[id]/edit/page.tsx`(僅 Admin 可重置他人的)
- **修改內容**:
  - **A. 個人改密碼**:
    - 表單欄位:目前密碼 / 新密碼 / 確認新密碼
    - 走 Supabase Auth `updateUser({ password })`,**前端驗證目前密碼**(透過再 `signInWithPassword` 驗一次)
    - 新密碼規則:至少 8 字、含大小寫 + 數字(用 zod)
    - 成功後 toast 提示,並建議重新登入
  - **B. Admin 重置他人密碼**:
    - 在 `/settings/users/[id]/edit` 頁面提供「重置密碼」按鈕
    - 點擊後彈窗:輸入新密碼(或選「產生隨機密碼」)
    - 走 Supabase Admin API `auth.admin.updateUserById(uid, { password })`(需要 service role key,Server Action 內呼叫)
    - 成功後顯示新密碼一次(僅本次彈窗,不存至資料庫),提示 Admin 通知該使用者
    - 寫一筆 `activity_log`:`password_reset_by_admin`,記錄誰幫誰重置
- **新增頁面/檔案**:
  - `app/(dashboard)/account/security/page.tsx`
  - `app/(dashboard)/account/security/actions.ts`
  - `app/(dashboard)/settings/users/[id]/edit/page.tsx`(若已存在則新增區塊)
  - `app/(dashboard)/settings/users/[id]/actions.ts`(新增 `resetUserPassword` action)
- **驗收**:
  - [x] 一般顧問可改自己密碼(需驗目前密碼,透過 `signInWithPassword` 重新驗一次)
  - [x] Admin 可在 `/settings/users/[id]/edit` 重置任何人密碼(走 service-role `auth.admin.updateUserById`)
  - [x] 一般顧問進不了 `/settings/users/*`(per-page admin gate)
  - [x] 重置動作寫入 `activity_log`(`password_reset_by_admin`,payload 含 target_name)
- [x] 完成
  - 新檔:`lib/supabase/admin.ts`(service role client, server-only)、`lib/validators/auth.ts`(密碼規則 + 隨機產生器)
  - 個人:`/account/security` + form 元件(現密驗證後 `auth.updateUser`)
  - Admin:`/settings/users` 列表 + `/settings/users/[id]/edit` 含 `<ResetPasswordCard>`(產生隨機密碼按鈕、僅顯示一次的回傳卡片)
  - Topbar 用戶下拉新增「修改密碼」連結;Settings 首頁新增「用戶管理」入口

### 0.5 未開發頁面顯示「營運正在料理中」
- **位置**:以下頁面目前是 404
  - `app/(dashboard)/applications/page.tsx`(申請總覽)
  - `app/(dashboard)/workload/page.tsx`(Workload)
  - `app/(dashboard)/reports/page.tsx`(報表)
  - 以及任何側邊欄出現但點進去 404 的頁面
- **修改內容**:
  1. 建立共用元件 `components/common/under-construction.tsx`:
     - 顯示文字「營運正在料理中」+ 副文字「此功能正在開發中,敬請期待」
     - 視覺:icon (lucide-react `ChefHat` 或 `Construction`) + 居中文字
     - 用 shadcn Card 包住,維持風格一致
  2. 上述每個頁面建立 `page.tsx`,內容為:
     ```tsx
     export default function Page() {
       return <UnderConstruction title="申請總覽" />
     }
     ```
- **驗收**:
  - [ ] 側邊欄點擊「申請」、「Workload」、「報表」不再 404
  - [ ] 顯示統一的「營運正在料理中」畫面
  - [ ] 視覺風格與其他頁面一致(用 shadcn 卡片包住)
- [ ] 完成

---

## 1. 設定後台(`/settings/*`)

> ⚠️ **本章統一規則**:`/settings/*` 全部頁面僅 **Admin** 可進入。在 `app/(dashboard)/settings/layout.tsx` 加入 middleware 擋,非 Admin 直接 redirect 到 `/`。同時側邊欄「設定」入口對非 Admin 隱藏。

### 1.1 名單來源 + 轉介人維護(完整 CRUD)
- **位置**:`app/(dashboard)/settings/lead-sources/`
- **目前狀態**:既有但不完整(Phase 1.4 已完成基礎,但缺編輯/刪除)
- **修改內容**:
  1. **名單來源(`lead_sources` 表)**:
     - 列表頁:所有來源(含停用的灰顯)
     - 新增 / 編輯 / 軟刪除(`is_active = false`)
     - 每個來源可設定預設轉介人(可空)
  2. **轉介人(`referrers` 表)**:
     - 列表頁:所有外部轉介人 + 關聯的名單來源
     - 新增 / 編輯 / 軟刪除
     - 欄位:姓名、聯絡方式、預設拆分比例、備註
  3. **關聯維護**:
     - 同一來源可對應多位轉介人(多對多)
     - 建立 / 編輯協定時,選了來源後,「轉介人」下拉選單只列出該來源關聯的轉介人
- **DB 影響**:檢查 `lead_sources` 是否有 `is_active`、`default_referrer_id`;檢查 `referrers` 是否有 `default_split_percent`;確認是否需要 `lead_source_referrers` 中介表(多對多)
- **驗收**:
  - [x] Admin 可新增 / 編輯 / 停用名單來源(`/settings/lead-sources` + `LeadSourceFormDialog` + SD `create_lead_source`/`update_lead_source`)
  - [x] Admin 可新增 / 編輯 / 停用轉介人(referrer dialog 加 default_split_percent 欄位、6-arg SD variant)
  - [x] 在學生新增畫面,名單來源下拉動態讀 `lead_sources`,顯示 `label_zh`(以 sort_order 排序、隱藏停用)
  - [ ] 兩者關聯維護(M:N `lead_source_referrers` 表已建,UI 尚未做;此版只先做 `default_referrer_id` 一對一)
- [x] 完成(M:N UI 後續再補)
  - 重大 schema 變動(0022):
    - 新表 `lead_sources`(code/label_zh/default_referrer_id/is_active/sort_order)+ seed 既有 6 個 enum 值
    - `students.lead_source_id UUID NOT NULL FK` 替代 `students.lead_source_type`(資料已遷移、原欄位 + enum 已 DROP)
    - `referrers.default_split_percent NUMERIC(5,2)`
    - 預留 M:N `lead_source_referrers`
    - 重新 emit 0007 的 `update_student` 改用 `lead_source_id`
    - SD CRUD `create_lead_source`/`update_lead_source`(admin only,`_lead_source_authorize`)
    - 6-arg `create_referrer` / 8-arg `update_referrer` 含 default_split_percent

### 1.2 帳號建立 + 權限設定
- **位置**:`app/(dashboard)/settings/users/`
- **修改內容**:
  1. **列表頁**:`app/(dashboard)/settings/users/page.tsx`
     - 顯示所有顧問:姓名 / Email / 角色 / 部門(前/後) / 啟用狀態 / 最後登入時間
     - 篩選器:角色、部門、啟用狀態
  2. **新增帳號**:`app/(dashboard)/settings/users/new/page.tsx`
     - 表單:Email / 姓名 / 角色(consultant / manager / admin) / 部門(frontend / backend) / 初始密碼(或選「寄邀請信」)
     - 走 Supabase Admin API `auth.admin.createUser`,並同步寫 `profiles` 表
     - 寫 `activity_log`:`user_created_by_admin`
  3. **編輯帳號**:`app/(dashboard)/settings/users/[id]/edit/page.tsx`
     - 修改:姓名、角色、部門、啟用狀態
     - 重置密碼(見 0.4 B)
     - 停用帳號(soft delete,設 `is_active = false`,Supabase Auth 也 disable)
  4. **權限規則**:
     - 全部頁面僅 Admin 可見
     - Admin 不可刪除自己 / 不可把自己降級
- **DB 影響**:`profiles` 表確認欄位:`role`、`department`、`is_active`、`created_by`、`last_login_at`,缺欄位則建立 migration
- **驗收**:
  - [x] Admin 可新增帳號並設定角色 / 部門(`/settings/users/new` + `auth.admin.createUser` + `admin_create_user_profile` SD;失敗時自動 rollback auth user)
  - [x] Admin 可重置任何人密碼(0.4 B 已完成)
  - [x] Admin 不可降級 / 刪除自己(SD `admin_update_user_profile` / `admin_set_user_active` 內嵌守則)
  - [x] 非 Admin 進不來(per-page admin gate)
  - [x] 列表加篩選器(角色 / 部門 / 啟用狀態 / 搜尋姓名 Email)
  - [x] 列表顯示「最後登入時間」(從 `auth.admin.listUsers` 取 `last_sign_in_at`)
  - [x] 編輯頁可改姓名 / 顯示名稱 / 角色 / 部門
  - [x] 停用 / 重新啟用按鈕(同步 `auth.admin.updateUserById` 設 ban_duration 100年/none)
- [x] 完成
  - 0024 migration 加 `profiles.created_by` + 三個 SD function
  - 新檔:`/settings/users/new` 頁 + form + 對話結束顯示初始密碼一次
  - 新增 `<ProfileEditCard>` 整合到既有編輯頁;停用 toggle 在卡片底部

### 1.3 學生狀態總列表維護
- **位置**:`app/(dashboard)/settings/student-statuses/`
- **目的**:讓 Admin 彈性維護「學生狀態」清單(取代寫死的 enum)
- **修改內容**:
  1. **新增 `student_statuses` 表**:
     ```sql
     create table student_statuses (
       id uuid primary key default gen_random_uuid(),
       code text unique not null,           -- 內部代號,如 'new_lead'、'consulting'
       label_zh text not null,              -- 中文顯示,如「新名單」、「諮詢中」
       category text not null,              -- 'recruitment'(招生)/ 'application'(申請)/ 'special'(特殊)
       color text not null default '#94a3b8', -- 徽章顏色
       sort_order int not null default 0,
       is_active boolean not null default true,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     );
     ```
  2. **資料遷移**:把現有 13 個狀態(原 PRD 5.1 列出的)seed 進去
  3. **學生表改造**:
     - `students.status` 改為 `students.status_id uuid references student_statuses(id)`
     - 既有資料用 SQL update 對應到新表
     - 觸發器(寫 `student_status_history`)同步調整
  4. **設定頁 UI**:
     - 列表 + 新增 + 編輯 + 啟用/停用
     - 排序(可拖拉,寫回 `sort_order`)
     - 顏色選擇器
- **DB 影響**:**重大 schema 變更**,需專章 migration:
  - `supabase/migrations/YYYYMMDDHHMMSS_create_student_statuses.sql`
  - `supabase/migrations/YYYYMMDDHHMMSS_migrate_students_status_to_fk.sql`
- **驗收**:
  - [ ] `student_statuses` 表建立完成,seed 資料齊全
  - [ ] 學生表改用 FK,既有資料無遺失
  - [ ] Admin 可新增/編輯/停用狀態
  - [ ] 連動學生頁(見 2.2)
- [ ] 完成

---

## 2. 學生頁面(`/students/*`)

### 2.1 學生列表整列可點擊
- **位置**:`app/(dashboard)/students/page.tsx`(學生列表)
- **問題**:目前只有姓名是 `<Link>`,點擊其他位置沒反應
- **修改內容**:
  1. 整個 `<TableRow>` 變成可點擊(`onClick` 導向 `/students/[id]`)
  2. hover 整列加底色 + cursor-pointer(視覺回饋)
  3. **例外**:
     - 行內若有按鈕(如「編輯」、「刪除」)`stopPropagation`,不觸發列點擊
     - 若有 checkbox 也要 stopPropagation
- **建議實作**:
  ```tsx
  <TableRow
    className="cursor-pointer hover:bg-muted/50"
    onClick={() => router.push(`/students/${student.id}`)}
  >
  ```
- **驗收**:
  - [x] 點任一格(空白、姓名、狀態、Email)都能進詳細頁
  - [x] 行內操作按鈕仍可獨立點擊,不觸發列導航(目前無 inline button,但 Link 用 stopPropagation 預防雙觸發)
  - [x] hover 有視覺回饋(`bg-muted/50`)
- [x] 完成 — 抽出 `components/students/students-list-row.tsx`(client),server page 改傳 plain data;支援 Enter/Space 鍵觸發 + 右鍵新分頁(內層 Link 保留)

### 2.2 學生狀態改為下拉(連動 1.3)
- **位置**:
  - 新增/編輯學生表單
  - 學生 360° 主頁的狀態切換 UI
- **修改內容**:
  1. 移除原本三選一(若還有殘留的硬編碼)/ enum
  2. 改為 `<Select>`,options 來源:`student_statuses` 表(`is_active = true`,依 `sort_order`)
  3. **MVP 階段不限制流轉**(讓 Admin 自由切),但每次切換仍寫 `student_status_history` 與 `activity_log`
  4. 狀態徽章顏色用 `student_statuses.color`
- **驗收**:
  - [ ] 狀態下拉選單動態讀 `student_statuses`
  - [ ] 切換後寫 history + log
  - [ ] 徽章顏色用 `student_statuses.color`
- [ ] 完成

### 2.3 Defer(延後入學)功能
- **位置**:學生 360° 主頁
- **修改內容**:
  1. 主頁加一個 **「Defer 延後入學」按鈕**(僅當學生狀態為「錄取確認」、「入學準備」、「已入學」時顯示)
  2. 點擊後彈窗:
     - 新入學日期(date picker,必填)
     - 延後原因 (textarea,選填)
     - 延後入學同意書(檔案上傳,**PDF only**,必填)
  3. 送出後:
     - 寫入新表 `student_defers`:
       ```sql
       create table student_defers (
         id uuid primary key default gen_random_uuid(),
         student_id uuid not null references students(id) on delete cascade,
         original_enrollment_date date,
         new_enrollment_date date not null,
         reason text,
         agreement_file_path text not null,
         created_by uuid not null references profiles(id),
         created_at timestamptz not null default now()
       );
       ```
     - 寫 `activity_log`:`student_deferred`
     - 學生主頁顯示「已 Defer 一次,新入學:YYYY-MM-DD」徽章
  4. **多次 Defer**:允許,每次新增一筆紀錄,主頁顯示最新一筆
- **DB 影響**:新 migration `create_student_defers.sql`
- **Storage 影響**:新增 bucket `student-defer-agreements`(後端顧問+ Admin 可讀寫)
- **驗收**:
  - [ ] 符合條件學生才出現按鈕
  - [ ] 表單上傳欄位驗證正確,PDF 限制
  - [ ] 紀錄正確寫入,主頁顯示
- [ ] 完成

### 2.4 前端建檔即填「成績」欄位 + 後端詳細頁帶入
- **位置**:
  - 前端:`app/(dashboard)/students/new/page.tsx`(新增學生表單)
  - 後端:`app/(dashboard)/students/[id]/scores/page.tsx`(成績詳細頁)
- **修改內容**:
  1. **新增學生表單** 增加「初步成績」區塊(可摺疊,選填):
     - GPA(數字,4.0 制)
     - 托福總分 / 雅思總分(擇一,選填)
     - GRE / GMAT 總分(選填)
     - **不要求填寫子細節分數、考試日期等,單純為初步登錄**
  2. 送出時,把這些值寫進 `academic_scores` 表(每個成績類型一筆),`status = 'preliminary'`
  3. **後端詳細頁** 進入時自動帶入這些 preliminary 成績,後端顧問可進一步補完整(子科目分數、實際日期、證書檔案等)
  4. 前端送出後不可回頭改(資料本移交給後端)— UI 上 disable / hide「編輯成績」按鈕(只後端 + 主管 + Admin 可改)
- **DB 影響**:
  - **需要新增** `academic_scores.status` 欄位(`'preliminary'` / `'confirmed'`)
- **驗收**:
  - [ ] 新增學生時可選填初步成績
  - [ ] 後端編輯頁自動帶入 preliminary 資料
  - [ ] 前端顧問無法在事後改成績(權限檢查)
  - [ ] 學生主頁概覽塊可看到 GPA / 英文成績摘要
- [ ] 完成

### 2.5 編輯成績頁:GPA 不顯示考試日期 / 到期日期
- **位置**:`app/(dashboard)/students/[id]/scores/[scoreId]/edit/page.tsx`(以及成績編輯 sheet)
- **修改內容**:
  - 表單根據 `score_type`(考試類型)動態渲染欄位
  - 條件:
    ```ts
    if (scoreType === 'gpa') {
      // 不顯示「考試日期」、「到期日期」欄位
      // 不顯示「證書檔案」(GPA 沒有證書,改顯示「成績單檔案」)
    }
    ```
  - 用 React Hook Form 的 `watch('score_type')` 控制顯示
- **驗收**:
  - [x] 選擇 GPA 時,考試日期、到期日期欄位消失
  - [x] 改成 TOEFL/IELTS 等欄位重新出現
  - [x] GPA 模式下標籤改為「成績單檔案」
- [x] 完成

### 2.6 證書檔案上傳按鈕 hover 效果
- **位置**:成績編輯頁的「上傳證書」按鈕
- **修改內容**:
  - 用 shadcn 既有的 `<Button variant="outline">` 風格
  - 加入 hover 過渡:
    ```tsx
    className="transition-colors hover:bg-accent hover:text-accent-foreground hover:border-primary"
    ```
  - 拖曳檔案進入時(dragover)邊框變色 + 背景輕微高亮
- **驗收**:
  - [x] hover 時邊框 + 文字顏色變明顯(border-primary + accent 色系),Upload icon 微微上移
  - [ ] 拖曳檔案到按鈕上有視覺回饋(本輪未做 dragover,日後再加,因為自定 button 元素需要額外 onDragEnter / onDrop 處理)
- [x] 完成 — 改成隱藏 native input + 自定虛線邊框按鈕

### 2.7 時間軸事件改為中文
- **位置**:
  - 學生 360° 主頁時間軸 tab
  - 元件:`components/timeline/timeline-event.tsx`(或類似命名)
  - 資料來源:`activity_log` 表 `action` 欄位
- **問題**:目前顯示英文,例:`Marcusapplication_status_changed`(且字串黏在一起)
- **修改內容**:
  1. 建立 `lib/timeline/event-labels.ts`,維護 action → 中文對照表:
     ```ts
     export const EVENT_LABELS: Record<string, string> = {
       student_created: '建立學生',
       student_status_changed: '狀態變更',
       student_deferred: '延後入學',
       application_status_changed: '申請狀態變更',
       application_offer_received: '收到錄取',
       application_rejected: '收到拒絕',
       deal_created: '完成成交',
       deal_updated: '更新成交',
       document_master_version_created: '主文件新版本',
       document_variant_version_created: '客製文件新版本',
       portal_credentials_updated: '更新 Portal 帳密',
       housing_credentials_updated: '更新住宿帳密',
       visa_credentials_updated: '更新簽證帳密',
       password_reset_by_admin: '管理員重置密碼',
       user_created_by_admin: '管理員建立帳號',
       // ...完整列出所有現有 action
     }
     ```
  2. 顯示時:`{actorName} {EVENT_LABELS[event.action] ?? event.action}`
  3. **不忘加空格分隔**,例:「Marcus 變更了 申請狀態」(不是「Marcusapplication_status_changed」)
  4. 樣板化:`{actor} {action}{target ? ` · ${target}` : ''}`
- **驗收**:
  - [x] 所有時間軸事件顯示中文(覆蓋 student / deal / school_list / applications_expanded / document / score / application / commission / portal 等 action)
  - [x] 操作者姓名與事件描述之間有空格(default case 也加了空格)
  - [x] 沒對照的 action fallback 為 `${actor} ${action}` 並標為「其他」分類
- [x] 完成 — `lib/activity-log.ts` 重寫
- **位置**:同 2.7
- **修改內容**:
  1. 在 `event-labels.ts` 同時定義分類:
     ```ts
     export const EVENT_CATEGORIES = {
       basic: '基本資料',          // student_created, student_status_changed, student_deferred
       deal: '成交',               // deal_*, commission_*
       schools: '選校',            // school_list_*, school_application_*
       documents: '文件',          // document_*, word_quota_*
       applications: '申請',       // application_*
       credentials: '帳密管理',    // portal_*, housing_*, visa_*
       admin: '管理操作',          // password_reset_*, user_created_*
     } as const

     export const EVENT_TO_CATEGORY: Record<string, keyof typeof EVENT_CATEGORIES> = {
       student_created: 'basic',
       student_status_changed: 'basic',
       deal_created: 'deal',
       // ...
     }
     ```
  2. 時間軸 UI 上方加入 **分類篩選 chips**(可多選)
  3. 預設全選,點擊 chip 切換顯示/隱藏
  4. 每筆事件左側加分類色塊或 icon(用 lucide-react,例如 `User` / `DollarSign` / `GraduationCap` / `FileText` / `Send` / `Key` / `Shield`)
- **驗收**:
  - [x] 時間軸頂部出現分類 chips(只列出該學生實際出現過的類別,並顯示 count)
  - [x] 點擊 chip 篩選該類事件(單選 + 「全部」)
  - [x] 每筆事件視覺上能一眼分辨類別(per-action icon + color)
- [x] 完成 — 抽出 `components/students/timeline-list.tsx`(client),server 只負責資料與 actor map

### 2.9 成交解鎖機制(選校表 / 文件 / 申請)
- **位置**:學生 360° 主頁 Tabs
- **修改內容**:
  1. **解鎖規則**:必須存在至少一筆 `deals` 紀錄(`status = 'active'`),才能進入:
     - 選校表 tab
     - 文件 tab
     - 申請 tab
  2. **未解鎖時**:這三個 tab 上顯示 🔒 lock icon,點擊時:
     - 顯示提示:「請先完成成交建立後再使用此功能」
     - 提供按鈕「前往建立成交」→ 跳到成交 tab
  3. **實作方式**:
     ```tsx
     const isUnlocked = !!activeDeal
     <TabsTrigger value="schools" disabled={!isUnlocked}>
       選校表 {!isUnlocked && <Lock size={12} className="ml-1" />}
     </TabsTrigger>
     ```
  4. **路由保護**:即使直接打網址 `/students/[id]/schools`,server component 也要檢查 deal 是否存在,沒有則 redirect 回主頁並顯示 toast
- **驗收**:
  - [ ] 未成交學生看到三個 tab 鎖住
  - [ ] 完成成交後三個 tab 自動解鎖
  - [ ] 直接打網址也擋
- [ ] 完成

### 2.10 簽證 / 住宿帳密管理(類 Portal 帳密)
- **觸發條件**:當學生其中一所學校 `applications.status = 'enrolled'`(確定入學)時
- **位置**:學生 360° 主頁,新增「入學準備」區塊(在「Portal 帳密」下方)
- **修改內容**:

  > **採納調整**(2026-05-06):`student_credentials.application_id UUID NULL`,portal 必填學校、visa/housing 留空(學生層級)。**既有 `applications` 上的 portal 欄位保留不動**,新表只承載 visa/housing(將來如果想統一可後續另做遷移 migration)

  1. **DB 變更**:
     - 新增 `student_credentials` 表(承載 visa/housing,**未來可選擇是否合併 portal**):
       ```sql
       create table student_credentials (
         id uuid primary key default gen_random_uuid(),
         student_id uuid not null references students(id) on delete cascade,
         application_id uuid references applications(id) on delete cascade,  -- portal 必填、visa/housing 留空
         credential_type text not null check (credential_type in ('portal','visa','housing')),
         label text not null,                     -- 顯示名稱,如「美國 F1 簽證」、「USC 學生宿舍」
         url text,
         account text,
         password_encrypted text not null,        -- AES-256-GCM 加密
         notes text,
         created_by uuid not null references profiles(id),
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now(),
         constraint chk_portal_has_app check (
           (credential_type = 'portal' and application_id is not null)
           or (credential_type in ('visa','housing'))
         )
       );
       create index on student_credentials(student_id, credential_type);
       ```
     - **本輪不遷移既有 `applications.portal_*` 欄位**,僅新增表給 visa/housing 使用
  2. **UI**:
     - 一個 `<CredentialsManager type="visa|housing" />` 元件,複用兩次:
       - 簽證帳密(學生 enrolled 後解鎖)
       - 住宿帳密(學生 enrolled 後解鎖)
     - 解鎖判斷:`SELECT count(*) FROM applications WHERE student_id = ? AND status = 'enrolled' >= 1`
     - 未解鎖顯示 🔒 + 說明:「待學生確定入學後啟用」
  3. **加密複用**:沿用現有 `lib/crypto.ts`(0.4 已建立)
  4. **權限**:僅後端顧問 / 主管 / Admin 可看
- **驗收**:
  - [ ] 任一申請 `status = 'enrolled'` 後,簽證 / 住宿區塊解鎖
  - [ ] CRUD 完整,密碼加密儲存
  - [ ] 寫入 `activity_log`(`visa_credentials_updated` / `housing_credentials_updated`)
- [ ] 完成

### 2.11 上傳檔案區(申請準備 Checklist)
- **位置**:學生 360° 主頁,新增「申請準備檔案」區塊
- **目的**:後端顧問可選哪些文件需要學生上傳,並追蹤狀態
- **修改內容**:

#### 2.11.1 新增 `student_required_documents` 表
```sql
create table student_required_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  document_template_id uuid not null references document_templates(id),
  is_required boolean not null default true,        -- 後端勾選
  status text not null default 'pending'            -- 'pending' / 'uploaded' / 'verified' / 'rejected'
    check (status in ('pending','uploaded','verified','rejected')),
  file_path text,                                    -- Supabase Storage path
  uploaded_at timestamptz,
  uploaded_by uuid references profiles(id),
  verified_at timestamptz,
  verified_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, document_template_id)
);
```

#### 2.11.2 新增 `document_templates` 表(全公司共用範本,在 settings 維護)
```sql
create table document_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label_zh text not null,
  category text not null check (category in ('school_application','visa_enrollment','other')),
  description text,
  notes text,                            -- 注意事項
  default_required boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true
);
```

#### 2.11.3 Seed 預設清單(13 項,見 Appendix A)

#### 2.11.4 UI:後端勾選 + 學生上傳(統一畫面)
- 區塊頂部說明:「⚠ 由於各校申請要求不同,提醒應根據學校要求向學生索取額外資料」「⚠ 注意英文拼字於音譯與護照相同」「⚠ 所有文件需為彩色掃描或拍照」
- 列表分類顯示(學校申請文件 / 簽證入學文件 / 其他)
- 每一行:
  - 左側:checkbox(後端勾選是否要求)
  - 中間:文件名稱 + 注意事項(hover 出現完整說明)
  - 右側:狀態徽章(待上傳 / 已上傳 / 已驗證 / 退件) + 上傳/查看/下載按鈕
- 後端顧問可:勾選/取消勾選、查看上傳檔案、標註為已驗證、退件並備註

#### 2.11.5 Settings 頁同步
- `app/(dashboard)/settings/document-templates/` Admin 可維護全公司預設清單
- 新增/編輯/啟用停用/排序

#### 2.11.6 Storage
- 新增 bucket `student-required-documents`(後端 + Admin 可讀寫,前端顧問可讀)

- **驗收**:
  - [ ] `document_templates` 表 seed 完成,含上方 13 項
  - [ ] Admin 可在 settings 維護清單
  - [ ] 後端顧問可在學生頁勾選需要的文件
  - [ ] 上傳 / 驗證 / 退件流程完整
  - [ ] 各動作正確寫入 `activity_log`
- [ ] 完成

### 2.12 一鍵打包功能(交接給學生)
- **位置**:學生 360° 主頁,「入學準備」區塊內最頂部按鈕
- **觸發條件**:學生有至少一所申請校 `status = 'enrolled'`
- **修改內容**:

#### 2.12.1 流程
1. 點擊「📦 一鍵打包資料」按鈕
2. 跳出彈窗(`<Dialog>`),分類顯示可打包項目,每項有 checkbox:
   - **入學帳密**(預設勾選)
     - [ ] 學校 Portal 帳密(列出每所學校,獨立勾選)
     - [ ] 簽證系統帳密
     - [ ] 住宿帳密
   - **申請相關文件**
     - [ ] 學生資料表格
     - [ ] 護照影本
     - [ ] (依 `student_required_documents` 動態列出已上傳的)
   - **錄取/獎學金文件**
     - [ ] 各校 Offer Letter(列出已收到的)
     - [ ] 獎學金通知信
   - **書審成稿**
     - [ ] 各校客製的 SOP / CV / 推薦信(最終定稿版本)
   - **其他**
     - [ ] 延後入學同意書(若有)
     - [ ] 學生 Defer 紀錄
3. 顯示「打包說明」textarea(選填,給學生的訊息)
4. 點「產生打包檔」→ Server Action:
   - 從 Supabase Storage 抓檔案,合成一個 ZIP
   - 帳密類資料解密後寫入一個 `credentials.pdf`(用 pdf 產生器,或 markdown → pdf)
   - 上傳至 `student-handover-packages` bucket,產生有效的 signed URL(7 天)
   - 寫 `activity_log`:`handover_package_created`
   - 顯示下載連結 + 「複製連結」按鈕

#### 2.12.2 DB
```sql
create table student_handover_packages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  contents jsonb not null,                  -- 記錄打包了哪些東西的 manifest
  file_path text not null,                  -- Storage 路徑
  signed_url_expires_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
```

#### 2.12.3 安全
- **打包檔開密碼保護**(產生隨機 8 碼密碼,顯示給顧問;ZIP 用密碼加密)
- 顧問需另外把密碼透過安全管道告知學生
- Signed URL 7 天後過期

- **驗收**:
  - [ ] 條件達成後出現「一鍵打包」按鈕
  - [ ] 彈窗分類列出可打包項目
  - [ ] 產生加密 ZIP + signed URL
  - [ ] 寫入打包紀錄
- [ ] 完成 [UI REF: TBD]

---

## 3. 文件頁面(`/students/[id]/documents/*`)

### 3.1 版本歷史可點擊查看內容
- **位置**:`app/(dashboard)/students/[id]/documents/[docId]/page.tsx`(文件詳細頁,版本歷史側欄)
- **問題**:目前可看到版本列表,但無法點擊查看舊的內容
- **修改內容**:
  1. 版本歷史每一筆改為可點擊
  2. 點擊後在主編輯區變為 **唯讀模式**,顯示該版本內容
  3. 版本檢視模式下:
     - 頂部黃色 banner:「您正在檢視 v3 版本(2025-04-28 by Marcus),為唯讀模式」
     - 提供按鈕「回到最新版本(v8)」
     - 提供按鈕「以此版本為基礎建立新版本」(複製內容到新版本)
  4. **不允許直接編輯舊版本**(避免歷史竄改)
  5. 對比功能(可選做):兩個版本選擇器 → 顯示 diff
- **元件影響**:
  - `components/documents/document-editor.tsx`(增加 `readOnly` prop 與 viewing version state)
  - `components/documents/version-history.tsx`(每筆 onClick 切換)
- **驗收**:
  - [ ] 點擊版本歷史可顯示該版內容
  - [ ] 唯讀模式視覺明確(banner + disable 編輯框)
  - [ ] 「回到最新版」按鈕能正確切回
  - [ ] 「以此版本建立新版」會 fork 內容(扣字數依現有規則)
- [ ] 完成

---

## 4. 選校表頁面(`/students/[id]/schools/*`)

### 4.1 移除「衝刺」、「匹配」改名「合適」
- **位置**:
  - DB:`school_list_items.tier` 欄位
  - 前端 enum / labels
- **修改內容**:
  1. **DB migration**:
     ```sql
     -- 1. 把現有 'reach' 資料合併進「合適」(match),維持原有用法
     -- 決策:把 reach 全部改為 match
     update school_list_items set tier = 'match' where tier = 'reach';

     -- 2. 加 check 約束,只允許三種 tier
     alter table school_list_items
       drop constraint if exists school_list_items_tier_check;
     alter table school_list_items
       add constraint school_list_items_tier_check
       check (tier in ('dream','match','safety'));
     ```
  2. **前端 labels**:
     ```ts
     export const TIER_LABELS = {
       dream: '夢幻',
       match: '合適',
       safety: '保底',
     } as const
     ```
  3. **顏色**(連動 4.2):
     ```ts
     export const TIER_COLORS = {
       dream:  { bg: '#FCE7F3', text: '#9D174D' },  // 淡粉
       match:  { bg: '#FEF3C7', text: '#92400E' },  // 淡黃
       safety: { bg: '#DBEAFE', text: '#1E40AF' },  // 淡藍
     } as const
     ```
- **驗收**:
  - [ ] 既有「衝刺」資料合併到「合適」
  - [ ] UI 上不再出現「衝刺」、「匹配」字樣
  - [ ] DB 約束生效,新增不能用 'reach'
- [ ] 完成

### 4.2 新增學校自動排序 + 顏色 + 保留手動調整
- **位置**:選校表頁面
- **修改內容**:
  1. **DB**:`school_list_items` 增加 `sort_order int not null default 0`(若沒有)
  2. **新增學校時自動排序邏輯**:
     - 依 tier 分組,夢幻在最上,合適中間,保底最下
     - 同 tier 內,依新增時間或手動排序
     - SQL 排序:
       ```sql
       order by
         case tier when 'dream' then 1 when 'match' then 2 when 'safety' then 3 end,
         sort_order asc,
         created_at asc
       ```
  3. **視覺**:
     - 每張學校卡片背景色依 tier 著色(用 4.1 的 TIER_COLORS)
     - 不同 tier 之間有分隔線 + 標題(「夢幻」、「合適」、「保底」)
  4. **手動調整**:
     - 保留拖曳排序(用 `@dnd-kit/core`)
     - 拖到不同 tier 卡片時,自動更新該卡片的 tier
     - 拖曳結束後 batch update `sort_order`
- **驗收**:
  - [ ] 新增學校自動排到正確分組
  - [ ] 卡片顏色與 tier 對應
  - [ ] 拖曳可手動調整順序
  - [ ] 拖到不同分組會變更 tier
- [ ] 完成 [UI REF: TBD]

---

## 5. 申請頁面(`/students/[id]/applications/*`)

### 5.1 錄取 / 拒絕狀態 → 顯示文件上傳按鈕
- **位置**:申請追蹤頁,每一所申請校的卡片
- **修改內容**:
  1. **狀態切換邏輯**:
     - 當 `applications.status` 切換為:
       - `admitted` → 顯示「上傳錄取通知書」按鈕
       - `rejected` → 顯示「上傳拒絕信」按鈕
  2. **檔案規格**:
     - 僅接受 **PDF**(MIME `application/pdf`)
     - 上傳到 Supabase Storage bucket `application-decisions`
     - 路徑:`{student_id}/{application_id}/{admitted|rejected}-{timestamp}.pdf`
  3. **DB**:
     ```sql
     alter table applications
       add column if not exists offer_letter_path text,
       add column if not exists rejection_letter_path text;
     ```
  4. **後端驗證**:
     - 切換狀態為 admitted 時,可先不上傳,但給警告 toast「請記得上傳錄取通知書」
     - 上傳後寫 `activity_log`:`application_offer_received` / `application_rejected`
  5. **顯示**:
     - 已上傳後改為「查看 / 重新上傳」按鈕
     - 卡片上顯示 PDF 圖示 + 連結
- **驗收**:
  - [ ] 狀態切到 admitted / rejected 時按鈕出現
  - [ ] 僅接受 PDF
  - [ ] 上傳後可查看 / 重新上傳
  - [ ] activity_log 正確記錄
- [ ] 完成

### 5.2 獎學金獨立維護區
- **位置**:申請追蹤頁,每一所申請校的卡片內(在「狀態」、「上傳文件」下方)
- **修改內容**:
  1. **DB**:新增 `application_scholarships` 表(支援未來一校多筆獎學金):
     ```sql
     create table application_scholarships (
       id uuid primary key default gen_random_uuid(),
       application_id uuid not null references applications(id) on delete cascade,
       has_scholarship boolean not null default false,
       amount_twd numeric(12,0),                    -- 新台幣,整數
       scholarship_name text,                        -- 獎學金名稱(選填,如 'Dean's Fellowship')
       award_letter_path text,                       -- 獎學金通知信 PDF
       notes text,
       created_by uuid not null references profiles(id),
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     );
     create index on application_scholarships(application_id);
     ```
  2. **UI**:
     - 標題「獎學金」
     - 主控:checkbox「該校有獲得獎學金」
     - 勾選後展開:
       - 獎學金名稱(text,選填)
       - 金額(NTD,整數,使用 0.2 的 NumberInput;預設空)
       - 上傳獎學金通知信(PDF only,bucket `application-scholarships`)
       - 備註(textarea)
     - 取消勾選 → 收起欄位,但保留資料(soft 機制)→ `has_scholarship = false`
  3. **顯示**:
     - 卡片摘要區顯示「💰 獎學金 NT$XXX,XXX」(若有)
  4. **多筆支援**:
     - 預留 UI「+ 新增另一筆獎學金」(同一校可有多種)
     - MVP 階段先做單筆(`UNIQUE (application_id)` 不加,但 UI 一次只顯示一筆),日後再擴充
- **驗收**:
  - [ ] 勾選後欄位出現
  - [ ] 金額用 NumberInput(無前導 0、無箭頭)
  - [ ] 通知信僅接受 PDF
  - [ ] 卡片上正確顯示獎學金摘要
  - [ ] 寫入 `activity_log`:`scholarship_recorded`
- [ ] 完成

---

## 6. 全域檢查清單(實作完成後)

- [ ] 所有新增 migration 在 staging 環境跑過,無錯誤
- [ ] RLS policy 對所有新表都有設定好(students 相關表 → 顧問僅存取自己負責的)
- [ ] Storage bucket 權限對應角色正確
- [ ] 全站再次 grep `<Input type="number">`,確認都改用 NumberInput
- [ ] 全站再次 grep 英文 action 字串,確認時間軸都改中文
- [ ] 側邊欄所有路由皆可進入(404 → 改顯示 under-construction)
- [ ] 一個非 Admin 帳號跑一輪:settings 全部進不去、改不到自己以外的學生
- [ ] 一個 Admin 帳號跑一輪:CRUD 帳號、CRUD 狀態、CRUD 名單來源、CRUD 文件範本

---

## Appendix A:申請準備 Checklist 預設清單

用於 2.11 `document_templates` 的 seed migration。

### A.1 學校申請文件(category = `school_application`)

| sort | code | label_zh | notes |
|---:|---|---|---|
| 10 | `student_data_form` | 學生資料表格 | 申請學校前須填寫完整 |
| 20 | `passport_copy` | 護照影本 | 彩色掃描檔案並簽名於「持照人簽名欄位」;需要有兩年以上有效期 |
| 30 | `electronic_signature` | 電子簽名 | 須與護照簽名一致,學校申請時需要 |
| 40 | `id_card` | 身分證正反面 | 請將正反面彩色或拍照掃描上傳 |
| 50 | `transcript_zh_en` | 中英在校成績單 | 在學中:截至大三上;已畢業:完整成績單,包含畢業年月份、學位名稱 |
| 60 | `enrollment_certificate_zh_en` | 中英在學證明 | 在學中需提供 |
| 70 | `diploma_zh_en` | 中英畢業證書 | 已畢業需提供;需檢查:是否有完整畢業年月份、護照相同英文名字、學位名稱(Bachelor of xxx) |
| 80 | `english_test_score` | 英文考試成績單 | 官方電子檔 |
| 90 | `sealed_transcript_x2` | 彌封的中英文成績單 ×2 | 須開於申請學校及申請副份備用;需要時時機:學校申請階段要求 WES 認證、學校紙本要求、辦理入學手續交 |

### A.2 簽證/入學文件(category = `visa_enrollment`)

| sort | code | label_zh | notes |
|---:|---|---|---|
| 110 | `entry_exit_record` | 出入境證明(出生到現在) | 需至內政部移民署設櫃申請(請勿線上申請!);需申請時包含家名稱、轉機資訊等版本 |
| 120 | `degree_certificate_zh_en` | 中英學位證明 | 辦理入學時繳交(用於代替畢業證書,因為學校收到資料後不易遞給學生) |
| 130 | `financial_proof_zh_en` | 中英財力證明 | 拿到銀行信徒查更換提供來源及注意事項 |
| 140 | `household_registration_zh_en` | 中英戶籍謄本 | 如果來自財力證明之帳戶非學生本人需提供 |

### A.3 通用注意事項(顯示於上傳檔案區頂部)

- 由於各校申請要求不同,提醒應根據學校要求向學生索取額外資料
- 注意英文拼字於音譯與護照相同
- 所有文件需為彩色掃描或拍照

---

## Appendix B:UI Reference 參考圖

> [TBD - 使用者後續提供]
>
> 後補參考圖可能對應以下小節,請 Claude Code 收到參考圖後依照描述比對:
> - 2.11 上傳檔案區的介面風格
> - 2.12 一鍵打包彈窗的 UI
> - 4.2 選校表卡片的視覺(夢幻 / 合適 / 保底配色與分區)
> - 5.2 獎學金區塊的設計
> - 共用元件:NumberInput、Under Construction 頁、時間軸分類 chips

---

## Appendix C:執行順序建議

雖然使用者一次貼給 Claude Code,以下是建議的執行順序(由低風險 → 高風險):

1. **0.5** Under Construction 頁(無 DB 改)
2. **0.2 / 0.3** NumberInput 元件(純前端共用元件)
3. **2.1** 學生列表整列可點擊(純前端)
4. **2.5 / 2.6 / 2.7 / 2.8** 成績編輯細節 + 時間軸中文/分類(輕量改動)
5. **0.4** 修改密碼(涉及 Auth Admin API)
6. **1.1 / 1.2 / 1.3** Settings 後台(涉及新表 + Admin 權限)
7. **2.2** 學生狀態下拉(承接 1.3)
8. **2.4** 前端建檔成績欄位
9. **2.3** Defer 功能(新表 + Storage)
10. **2.9** 成交解鎖機制
11. **3.1** 文件版本歷史檢視
12. **4.1 / 4.2** 選校表 tier 改造
13. **5.1 / 5.2** 申請頁 PDF 上傳 + 獎學金
14. **2.10** 簽證 / 住宿帳密
15. **2.11** 上傳檔案區 + Checklist seed(較大功能)
16. **2.12** 一鍵打包(最複雜,放最後)

---

**文件版本**:v1.0
**待補項目**:UI Reference(Appendix B)
**最後更新**:2026-05-06 確認採納並開始 Phase 4.5 執行
