# 收緊 /settings 等路由為 admin-only — 修補紀錄

日期:2026-06-10
背景:UAT(Stage 1-B 跨角色驗證)發現 `/settings` 的實際路由閘門是 `isManagerOrAdmin`(主管也進得去),但權限矩陣 §3.1／§6.2 的設計是 **admin-only**。Jo 裁示:收緊程式碼以符合矩陣。
緩解現況:RLS 仍限制 settings 表僅 admin 可寫,故原本只是「主管看得到 UI」、非資料外洩;本次把 UI/路由也收緊到 admin-only。
範圍:只改授權判斷,未動 RLS / Storage / 金鑰 / 資料。

---

## 變更檔案 / 路由

| 檔案 | 變更 | 影響路由 |
|---|---|---|
| `app/(dashboard)/settings/layout.tsx` | 路由閘門 `isManagerOrAdmin` → **`isAdmin`**;非 admin(含 manager)redirect 回 `/` | **`/settings` 及全部子頁**:學生狀態清單、名單來源/轉介人、服務方案(方案內容/價格/加購單價)、用戶管理(帳號清單/重置密碼) |
| `components/layouts/sidebar.tsx` | 「設定」nav item `roles: ['manager_frontend','manager_backend','admin']` → **`['admin']`** | 側欄「設定」入口只對 admin 顯示(與路由閘門一致) |

> 單點收緊:`/settings` 的 layout 是所有設定子頁的共同閘門。改它即涵蓋全部子頁——包含原本**沒有自帶 isAdmin 檢查、僅靠 layout** 的 `settings/referrers` 與設定首頁(這兩個原本主管進得去,現已一併被擋)。

---

## `isManagerOrAdmin` 全使用點清查與處置

`grep -rn isManagerOrAdmin app/ components/ lib/` 結果逐一對照矩陣:

| 使用點 | 用途 | 矩陣判定 | 處置 |
|---|---|---|---|
| `app/(dashboard)/settings/layout.tsx:19` | /settings 路由閘門 | **admin-only** | ✅ **改為 isAdmin** |
| `app/(dashboard)/duplicate-overrides/page.tsx:31` | /duplicate-overrides 閘門 | 主管+admin(§3.1「查看 /duplicate-overrides 清單」) | **不動**(維持 admin+manager) |
| `app/(dashboard)/students/actions.ts:176` | `canOverride`:重複名單覆寫 | 主管+admin(Stage 2-A 決策:覆寫限 admin/manager) | 不動 |
| `app/(dashboard)/students/[id]/page.tsx` ×5(canDelete、成績加分、加分卡…) | 學生詳情頁權限(刪除學生、成績編輯等) | 主管+admin(§3.1 刪除學生/編輯成績 = manager ✅) | 不動 |
| `app/(dashboard)/students/[id]/documents/[masterId]/page.tsx:51`、`.../variants/[variantId]/page.tsx:65` | 文件編輯權限 | 文件管理 新增/編輯 = manager ✅ | 不動 |
| `app/(dashboard)/schools/page.tsx:40`、`schools/[id]/page.tsx:39` | 院校資料庫 建立/編輯(`canCreate/canEdit`) | 矩陣未標 admin-only;非 settings 範圍 | 不動 |
| `components/students/student-form.tsx:155` | `canPickConsultant`:建檔時可挑承辦顧問 | 指派顧問 = 主管+admin | 不動 |
| `lib/constants/roles.ts:14` | `isManagerOrAdmin` 函式定義 | — | 不動(其他正當用途仍需要) |

**`/uat/admin`(Admin 總覽):已是 admin-only,無需改**
- 路由:`app/(dashboard)/uat/admin/page.tsx:38` 已是 `if (myRole !== 'admin') redirect('/')`。
- 側欄:`sidebar.tsx` 該 item 已是 `roles: ['admin']`。
- UAT 實測 manager 本來就被擋(見下)。

---

## 驗證結果

- ✅ `npm run typecheck`(0 error)、`npm run lint`(No warnings/errors)、`npm run build`(Compiled successfully)。
- ✅ **本機 dev server 跨角色實測**(以 uattest_ 測試帳號):

| 路由 / 元素 | 前端主管(manager) | Admin |
|---|---|---|
| `/settings` | **redirect → /**(收緊後被擋) | 通 ✓ |
| `/settings/referrers` | **redirect → /** | 通 ✓ |
| `/settings/plans` | **redirect → /** | — |
| `/settings/users` | **redirect → /** | 通 ✓ |
| `/uat/admin` | redirect → /(本就被擋) | 通 ✓ |
| `/duplicate-overrides` | **通(未被誤收緊)** ✓ | 通 ✓ |
| 側欄「設定」入口 | **隱藏** ✓ | 顯示 ✓ |

  - consultant 對 /settings、/uat/admin 的封鎖在 Stage 1-B UAT 已驗(redirect),本次未改其行為。
- ✅ 對照移交文件 §3.1 矩陣:設定相關(學生狀態、名單來源/轉介人、服務方案、用戶管理)+ Admin 總覽 = admin-only,逐項一致;/duplicate-overrides 維持主管+admin。

---

## 移交文件可更新

- **§6.2**:把「/settings/*:檢查 role === 'admin'」標為**已與程式碼一致**(程式已收緊;原本誤用 isManagerOrAdmin 的問題已解決)。
- **附錄 A 第 11 項(修補紀錄)/ 觀察**:Stage 1-B UAT 提出的「/settings 閘門 vs 矩陣不一致」已處置完成。
