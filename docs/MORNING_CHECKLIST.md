# 🌅 早安 Marcus — 昨晚自動完成 Phase 1.5-1.9

> 這份檔案是「你睡前我承諾的早上驗收清單」。看完做完即可丟。

---

## 1. 你**必須**先做的 — 跑 3 份 migration

我寫好了 SQL 檔但**沒辦法自動跑到你的 Supabase**(沒 token 也應該不要動)。請依序到 Supabase Dashboard → SQL Editor 跑下面三段 SQL,**順序很重要**(0007 → 0008 → 0009):

### Migration 0007 — `update_student` SECURITY DEFINER + 顧問交接
完整內容在 [`supabase/migrations/0007_update_student_and_handovers.sql`](../supabase/migrations/0007_update_student_and_handovers.sql),整份貼進 SQL Editor 跑。

### Migration 0008 — 服務方案 CRUD
完整內容在 [`supabase/migrations/0008_plan_cud.sql`](../supabase/migrations/0008_plan_cud.sql)。

### Migration 0009 — 建立成交(含拆分 + 字數帳本 + 自動轉狀態)
完整內容在 [`supabase/migrations/0009_create_deal.sql`](../supabase/migrations/0009_create_deal.sql)。**最大那份**(約 230 行)。

> 三份都會回 `Success. No rows returned`,沒看到就是出錯,把錯誤訊息丟給我。

---

## 2. 開瀏覽器測試(dev server 應該還在 PID 25557 跑著)

http://localhost:3000

**順序**:1.6 → 1.5 → 1.7+1.8(因為 1.7 需要先有方案存在)

### 2.1 — 服務方案(1.6,admin only)
- [ ] 側邊欄 → 設定 → 服務方案
- [ ] 「新增方案」→ 例:
  - 代碼 `US-MASTER-5`,名稱「美碩 5 校精選」
  - 基礎價格 `120000`,幣別 `TWD`
  - 含校數 5,含字數 15000
  - 適用國家勾「美國」,適用學位勾「碩士」
  - 啟用中 ✅
- [ ] 應 toast「已新增方案」+ 列表出現
- [ ] 點「編輯」可改回 → 改 base_price → 應 toast「已更新方案」
- [ ] 把 is_active 取消 → 列表 badge 變「已停用」

### 2.2 — 後端顧問派遣 + 顧問交接(1.5)
- [ ] 任一現有學生 → 點「編輯」
- [ ] 表單最下「名單來源 + 顧問派發」card 應有兩個 dropdown:**前端顧問** + **後端顧問**(admin / manager 才看得到)
- [ ] 後端顧問選一個同事 → 儲存
- [ ] 回詳細頁,「名單來源」card 應顯示後端顧問名字
- [ ] **時間軸 tab 應多一筆**「{你} 指派了後端顧問」(紫色 UserPlus icon)
- [ ] SQL Editor 跑 `SELECT * FROM consultant_handovers ORDER BY handed_at DESC LIMIT 5;` → 應有一筆 `handover_type='frontend_to_backend'`
- [ ] 把學生狀態改成「已成交」(若還沒)+ backend 留空 → 詳細頁應出現黃色 banner「請點編輯指派後端顧問」

### 2.3 — 建立成交 + 拆分(1.7 + 1.8)⭐ 核心
- [ ] 學生詳細頁 → 成交 tab → 「建立成交」(右側 Sheet 滑出)
- [ ] 選方案(剛剛建的「美碩 5 校精選」)→ 卡片應顯示「方案內含學校 5 / 方案內含字數 15,000」
- [ ] 加購學校 +1、加購字數 +5000、優惠 5000 → **最終金額**應即時計算
- [ ] 簽約日預設今天(Asia/Taipei),合約編號隨意
- [ ] **預設拆分**:主要顧問(該學生的前端顧問)100%
- [ ] 勾「有轉介人」→ 預設 65/35,且左 dropdown 可切「外部轉介人 / 內部同事」
  - [ ] 改 primary % 到 70 → referrer % 自動變 30(雙向聯動)
  - [ ] 取消勾選「有轉介人」→ 回到 100%
- [ ] 點「+新增主管獎金」→ 多一行,選一位主管 + %(如 5),不影響主拆分
- [ ] 點「建立成交」→ toast「成交建立成功」+ Sheet 關閉
- [ ] 詳細頁:
  - [ ] 狀態徽章變「已成交」(若原本是 qualified 之類的)
  - [ ] 成交 tab 出現一張卡,有最終金額、基礎/加購/優惠拆解、拆分明細(每筆顯示對象 + % + 金額)
  - [ ] 時間軸出現「{你} 建立了成交」+ 「將狀態從 X 改為 已成交」

### 2.4 — 字數帳本驗證
SQL Editor 跑:
```sql
SELECT created_at, transaction_type, amount, balance_after, description
FROM public.word_quota_ledger
WHERE student_id = '<該學生 id>'
ORDER BY created_at;
```
應看到:
- [ ] 一筆 `initial` = 15000(方案內含)
- [ ] 一筆 `addon` = 5000(加購字數)
- [ ] 第二筆的 `balance_after` = 20000

### 2.5 — RLS 驗證(1.9)
這是最重要的一步,但需要 4 個測試帳號。建議找個**安靜時段**走一遍 [`docs/09-rls-verification-checklist.md`](./09-rls-verification-checklist.md),每個區塊跑完打勾。
- [ ] A. 學生隔離(4 項)
- [ ] B. 成交 / 拆分(4 項)
- [ ] C. 字數帳本(3 項)
- [ ] D. 角色提升攻擊(3 項)
- [ ] E. SECURITY DEFINER 函式拒絕測試(6 函式)
- [ ] F. 軟刪除歷史保留(4 項)
- [ ] G. 顧問交接紀錄(2 項)

---

## 3. 我自動完成的事

### Commit 列表(從 1.4 commit 之後)
```
a504b0a  1.9  RLS verification checklist (Phase 1 code-complete)
3a261a3  1.7+1.8  deal creation with splits (migration 0009)
f9a1cdc  1.6  service plans CRUD (migration 0008)
bec9d50  1.5  backend consultant + handovers (migration 0007)
```

### Phase 1 整體進度
| 子項 | 狀態 |
|---|---|
| 1.1 學生 CRUD | ✅ |
| 1.2 學生 360° tabs | ✅ |
| 1.3 狀態流轉 | ✅ |
| 1.4 名單來源 + 轉介人 | ✅ |
| 1.5 顧問派發 / 交接 | ✅ |
| 1.6 方案管理 | ✅ |
| 1.7 成交流程 | ✅ |
| 1.8 績效拆分 | ✅ |
| 1.9 權限驗證 | ✅(文件 + 測試案例,**手動驗收待跑**) |

### 改動概覽
**新 migration**:0007 / 0008 / 0009(必須跑,見上方)

**新檔**:
- `lib/validators/{plan,deal}.ts` — zod schemas
- `app/(dashboard)/settings/plans/{page,actions}.tsx` — 方案 CRUD 頁
- `components/plans/plan-form-dialog.tsx`
- `app/(dashboard)/students/[id]/deals/actions.ts` — 建立成交 action
- `components/students/{create-deal-dialog,student-deals}.tsx` — 成交 UI
- `docs/09-rls-verification-checklist.md` — RLS 測試文件

**改動**:
- `lib/validators/student.ts` — 加 `backend_consultant_id`
- `app/(dashboard)/students/actions.ts` — `updateStudent` 改走 SECURITY DEFINER
- `components/students/student-form.tsx` — 後端顧問 dropdown
- `app/(dashboard)/students/[id]/page.tsx` — 成交分頁、closed_won banner、source name 顯示
- `lib/activity-log.ts` — `consultant_assigned` payload-aware 格式
- `app/(dashboard)/settings/page.tsx` — 服務方案卡片變 link

### 設計決策(無打擾你做)
- **SECURITY DEFINER 一致性**:延續 0004/0005/0006 的 RLS quirk workaround 模式;1.5 的 `update_student`、1.6 的 `create/update_service_plan`、1.7 的 `create_deal` 都用同樣方法。Action 層 `as never` cast 等你跑 `npm run gen:types` 後可移除
- **成交分頁開放對象**:`canCreate` 採用跟 `canChangeStatus` 同邏輯(manager+/admin OR 該學生顧問);這意味著一般顧問**也能**為自己學生建成交,符合 docs/05 的權限模型
- **closed_won 後端顧問派遣**:選擇用 detail page 黃色 banner 提醒(而非強制在狀態切換 dialog 中要求),理由是降低狀態切換 UI 的複雜度,banner 一直在直到指派為止,不會被忽略
- **RHF vs useState for deal form**:成交表單的 splits 區段用 `useState` 而非 react-hook-form 的 `useFieldArray`,因為動態行 + 雙向聯動 + 多 input type 切換用 `useFieldArray` 寫起來更繞;業務驗證(總和 100%、recipient 二擇一)由 server action + DB 函式雙重把關
- **Manager bonus 開放給所有人新增**:UI 沒鎖定,只要有建成交權限的人都能加 bonus row;業務面如果之後要鎖只給 admin,加 `currentUserRole` 條件即可

### 已知限制 / 後續工作
- **Generated types 待重跑**:0007/0008/0009 的函式仍透過 `as never` cast 呼叫,等下次 `npm run gen:types` 後可移除 cast
- **加購字數規則簡化**:目前用 `extra_word_quota / 1000 * unit_price`,小數會 truncate;若要嚴格按 1000 字為單位,UI input `step=1000` 已有,但沒強制驗證 1000 整數倍。可後續加
- **成交編輯 / 刪除未實作**:目前只能建立,不能改/刪。docs/08 §8 提及退費需 `terminated` + 手動處理會計,所以暫不開放編輯。若要做,模式同 update_student
- **連續成交(同學生第二筆 deal)** 已在 `create_deal` 內考慮 — `word_quota_ledger.balance_after` 會延續累加,不會 reset

---

## 4. 可選清理

如果一切順利、你想做點 housekeeping:
- [ ] `npm run gen:types`(需 Supabase access token)→ 把 9 支 SD 函式 type 進來,移除 actions.ts 裡的 6 個 `as never` cast
- [ ] 跑一遍 `docs/09-rls-verification-checklist.md` 整份(45-60 分鐘),把表格打勾
- [ ] 補一筆方案 + 一筆轉介人作為 seed,讓建立成交的 dropdown 一打開就有選項

---

## 5. 如果有東西壞掉

我覺得最可能炸的點:
1. **跑 0007 之前先去點編輯 → 會踩 `update_student` 函式不存在錯誤** → 跑 0007 即解
2. **方案沒先建就試建立成交 → Sheet 內 dropdown 顯示「尚無啟用中的方案」** → 先去 設定 → 服務方案 建一個
3. **dev server 還在跑舊 code 但 .next 沒重建** → 我之前的習慣是 kill + clear `.next` + restart;若你發現怪怪的就跑:
   ```bash
   npx kill-port 3000 && rm -rf .next && npm run dev
   ```

---

晚安變早安。Phase 1 結束了 🎉。Phase 2 是選校表 — 等你跑完驗收覺得 1.9 OK 後再開工。
