# 明天早上驗收清單(2026-05-07 凌晨自走作業總覽)

晚安交辦的 Appendix C 從 2.4 之後的全部項目都做完了,**只有 2.12 一鍵打包**因為需要新加 `archiver` 套件 + ZIP 加密邏輯,風險高所以沒做(原因見最後一節)。

---

## ⚙️ 一定要先做的事:套用 SQL

按順序在 Supabase Dashboard SQL Editor 執行,**順序很重要**(後面會引用前面的東西):

### Migrations(`supabase/migrations/` 內)
1. `0027_score_status_and_edit_lock.sql` — 成績加 `status`,前端鎖編輯
2. `0028_retire_tier_reach.sql` — 選校 tier 移除 reach
3. `0029_application_decision_files_and_scholarships.sql` — 申請 PDF + 獎學金表
4. `0030_student_credentials.sql` — 簽證/住宿帳密表
5. `0031_student_defers.sql` — Defer 延後入學表
6. `0032_required_documents.sql` — Checklist + Appendix A 13 項 seed

### Storage 設定(`supabase/setup/` 內)
1. `2.3_storage_defer_agreements.sql`
2. `2.11_storage_required_documents.sql`
3. `5.x_storage_decisions_scholarships.sql`

每份檔案結尾都有 `NOTIFY pgrst, 'reload schema'`,但若仍報「找不到 function」就在 SQL Editor 多跑一次:
```sql
NOTIFY pgrst, 'reload schema';
```

---

## 🌈 視覺更新(`801879d`)

- 主色從深藍改為品牌粉 `#C7315C`(`primary` / `ring`)
- 字體改 Plus Jakarta Sans + Noto Sans TC(無襯線),從 Google Fonts CDN 載入
- 圓角從 0.5rem → 0.625rem
- 整體配色按 reference 偏柔和

驗收:打開 `/students` 列表,新增按鈕、徽章、focus ring 應該都是粉紅色。

---

## ✅ 各小節驗收清單

### 2.4 — 前端建檔即填初步成績(`7030b62`)
- 進「新增學生」表單,看到「初步成績(選填)」卡片(GPA / 英文 / 標化測驗)
- 填好成績送出 → 進該生成績分頁 → 看到對應 row 帶有黃色「初步」徽章
- 用前端顧問身份(`role=consultant`+`department=frontend`)登入該生成績分頁,**不應看到**「新增成績 / 編輯 / 刪除」按鈕(後端維護鎖)
- 後端顧問或主管編輯這筆成績 → 儲存後「初步」徽章消失(`status` 自動 → `confirmed`)

### 2.9 — 成交解鎖機制(`62983dd`)
- 對一個沒成交的學生 → tab 列「選校表 / 文件 / 申請」應該有 🔒 灰底 disabled
- 點該 tab → 看到「尚未建立成交」虛線提示卡片
- 建第一筆成交 → 學生狀態自動切「已成交」(原本就有的)→ 三個 tab 同步解鎖

### 3.1 — 文件版本歷史可點擊(`565a726`)
- 進文件 master 詳情頁
- 點「版本歷史」中任一非最新版 → URL 多 `?v=<id>` → 編輯器變唯讀,黃色 banner 說「您正在檢視 V3」+ 兩顆按鈕
- 點「以此版本建立新版」→ URL 多 `&edit=1` → 編輯器可寫,banner 變橘色提示
- 編輯後存檔 → 新版本以 V3 內容為基礎(差異由 V7 實際算)
- 點「回到最新版本」→ URL 還原,看到最新版

### 4.1 / 4.2 — 選校表 tier 改造(`1347492`)
- 進選校表分頁 → 卡片顏色變「夢幻=粉 / 合適=黃 / 保底=藍」
- 列表自動依 tier 排序(夢幻在最上)
- 任何已存在的「衝刺 reach」row 都自動變成「合適 match」(migration 跑了 `UPDATE`)
- 不能再把 tier 設成 reach(DB CHECK 拒絕)

### 5.1 — 錄取 / 拒絕 PDF(`97933bb`)
- 把任一申請的狀態改成「錄取」→ Sheet 出現「錄取通知書」上傳區
- 上傳非 PDF → toast「檔案必須是 PDF 格式」
- 上傳 PDF → 看到檔名 + 下載 + 移除按鈕,DB `applications.offer_letter_path` 寫入
- 改成「拒絕」→ 同樣邏輯,但變「拒絕信」

### 5.2 — 獎學金區(`97933bb`)
- 同 Sheet 內看到「獎學金」section
- 勾「該校有獲得獎學金」→ 展開金額 / 名稱 / 通知信 PDF / 備註
- 金額用 NumberInput(無前導 0、無箭頭)
- 上傳獎學金通知信 PDF → 儲存 → 卡片顯示金額 + 通知信下載按鈕
- DB:`application_scholarships` 表

### 2.10 — 簽證 / 住宿帳密(`bcd3505`)
- 學生概覽分頁有兩張卡:「簽證帳密」+「住宿帳密」
- **未確定入學前 → 卡片顯示 🔒 + 提示「待學生確定入學後啟用」**
- 把任一申請狀態改成「確定入學」→ 兩張卡解鎖
- 點「新增」→ 對話框:名稱 / URL / 帳號 / 密碼 / 備註
- 密碼用 AES-256-GCM 加密(走既有 `lib/crypto.ts`)
- 顯示時 ●●●●●,點眼睛 reveal,點 Copy 寫剪貼簿
- 編輯時可選擇「變更密碼」或「保留原密碼」

### 2.3 — Defer 延後入學(`68014c6`)
- 把學生狀態改成「錄取確認 / 入學準備 / 已入學」之一 → 概覽分頁的「延後入學」卡片右上才會出現「Defer」按鈕
- 點按鈕 → 對話框:原入學日期(選填)/ 新入學日期(必填) / 原因 / 同意書 PDF(必填)
- 提交成功 → 卡片顯示最新一筆,黃色 highlight,有「同意書」下載按鈕
- 第二次 Defer → 卡片顯示新的最新,舊的進「歷史 Defer」摺疊區
- DB:`student_defers` 表;Storage:`student-defer-agreements` bucket

### 2.11 — 申請準備 Checklist(`d955ea0`)
- 概覽分頁有「申請準備檔案」卡片,**13 項預設清單**分兩類顯示(學校申請 9 項 + 簽證入學 4 項)
- 每項有 checkbox 可勾選是否需要(預設都勾)
- 取消勾選 → 該項變灰色刪除線
- 對勾選且未上傳的項目 → 看到「選檔」按鈕(`label`-based file picker)
- 上傳 PDF / 圖片 → 狀態徽章從「待上傳」變「已上傳」(藍色)
- 已上傳的項目 → 出現綠色 ✓ + 紅色 ✗ 兩按鈕
  - ✓ 標為已驗證(綠色徽章)
  - ✗ 退件(紅色徽章)
- DB:`document_templates`(seed 13)+ `student_required_documents`
- Storage:`student-required-documents` bucket

---

## ⚠️ 已知限制 / 待處理

### 2.12 一鍵打包 — **未做**
原因:需要 `archiver` npm 套件 + 加密 ZIP 邏輯(`archiver-zip-encryptable` 或類似),涉及:
1. ZIP 寫入 / 串流邏輯
2. 8 碼隨機密碼產生 + 顯示
3. 從多個 storage bucket 抓檔案 → 合併
4. 帳密類資料解密後寫進 PDF / TXT(需 PDF library 或乾脆 markdown)
5. Signed URL 7 天時效
6. `student_handover_packages` 表

整套要寫 ~300-500 行,而且 ZIP 套件常有 streaming bug,**沒測試就上線太冒險**。建議:
- 起床後手動跑 `npm install archiver archiver-zip-encryptable`(或用 `jszip` 純 JS 但較慢)
- 我幫你補完;或者你選簡化版(無加密 ZIP)我可以快速做

### 其他 spec 還沒做
- **0.1 點擊 responsiveness** — 之前說「先記錄、暫不修改」,已在 `docs/known-issues.md`
- **2.11 admin 後台 template 維護 UI** — 我目前只 seed 了 13 項,Admin 想加新 template 暫時要靠 SQL。可以後續再補一個 `/settings/document-templates/` 頁面

### 視覺更新後沒有重新 sweep 既有頁面
品牌色透過 CSS variables 自動套用,大部分元件會即時變色。但有些頁面用了 hardcoded 顏色(例如某些 emerald-600 / blue-600),這些不會變。如果你看到某處有違和感,告訴我我再調。

---

## 📊 統計

- **commits 完成**:9 個(visual + 8 個 spec features)
- **migrations**:6 個新增(0027–0032)
- **storage setup**:3 個新增
- **新表**:`application_scholarships`, `student_credentials`, `student_defers`, `document_templates`, `student_required_documents` = 5 個
- **新欄位**:`academic_scores.status`, `applications.offer_letter_path`, `applications.rejection_letter_path`
- **新 Storage buckets**:`application-decisions`, `application-scholarships`, `student-defer-agreements`, `student-required-documents` = 4 個
- **檔案異動**:約 30 個

晚安 🌙
