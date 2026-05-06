# Known Issues

未即時修正、留待後續處理的項目清單。

---

## #0.1 點擊 responsiveness(待後續評估)

**狀態**:已記錄,暫不修改
**來源**:`docs/specs/crm-spec-v1.md` § 0.1
**最後更新**:2026-05-06

### 現象
全站可點擊元素(button、card、row、tab)點擊後反應不夠即時,使用者感受是「等待時間久」。

### 假設成因(待驗證)
1. **Server Action 冷卻**:多數變更操作會走 Server Action(`useTransition` + `startTransition`),期間 UI disable;Server Action 內含 RPC + revalidatePath,網路 + DB 來回大概 200-500ms,使用者會感受到延遲
2. **`router.refresh()` 觸發整頁重抓**:Server Component 全部重 render,包括沒變的部分
3. **沒有 optimistic update**:幾乎所有交互都等 server 回來才更新 UI
4. **Supabase 冷啟動**:第一次操作有 cold start

### 已知出現位置(grep `useTransition` / `isPending`)
本檔僅列出已知有「點擊後 disable + 等待」模式的元件,作為日後排查參考:

- `components/students/student-status-changer.tsx`
- `components/students/word-quota-ledger-sheet.tsx`(加碼按鈕)
- `components/students/school-list-section.tsx`(展開為申請項、鎖定、新版本)
- `components/students/applications/application-detail-sheet.tsx`(各 block 儲存)
- `components/students/applications/applications-view.tsx`
- `components/students/scores/score-form-sheet.tsx`(新增 / 編輯)
- `components/students/scores/score-list.tsx`(刪除、下載)
- `components/students/student-deals.tsx`
- `components/students/delete-student-dialog.tsx`
- `components/plans/plan-form-dialog.tsx`
- `components/referrers/referrer-form-dialog.tsx`
- `components/schools/*-form-dialog.tsx`

### 後續處理方向(尚未決定)
- (a) 全面導入 `useOptimistic` 做樂觀更新(大改動)
- (b) 局部熱點優化(只挑常用按鈕)
- (c) Server Action 內把 `revalidatePath` 替換成 `revalidateTag` 縮小重抓範圍
- (d) 評估 React Server Component 的 `loading.tsx` 顯示骨架屏

待 Phase 4.5+ 完成後另開 task 評估。
