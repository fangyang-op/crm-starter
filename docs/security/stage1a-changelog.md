# Stage 1-A 修補紀錄

日期：2026-06-09
範圍：僅 P0 密碼產生器弱亂數 + 非破壞性 npm audit fix。**未動任何 Stage 0 報告中的 P1/P2 項目**(Next.js 升級、上傳內容驗證、CSV injection、phone 反查、最小揭露等皆未處理)。

---

## P0：密碼產生器(弱亂數)

- **檔案**：`lib/validators/auth.ts`(`generateRandomPassword()`)
- **呼叫端(未改動,簽名相容)**:
  - `app/(dashboard)/settings/users/new/new-user-form.tsx:45`(建立使用者「隨機」按鈕)
  - `app/(dashboard)/settings/users/[id]/edit/reset-password-card.tsx:30`(重設密碼「產生隨機密碼」按鈕)

### 修正前 → 修正後

| 項目 | 修正前 | 修正後 |
|---|---|---|
| 亂數來源 | `Math.random()`(非密碼學安全 PRNG) | `crypto.getRandomValues()`(Web Crypto CSPRNG) |
| 取樣方式 | `Math.floor(Math.random()*n)`(有 modulo bias) | 新增 `randomBelow(n)` helper,**rejection sampling** 去除 modulo bias |
| 註解 | 謊稱「Cryptographically-random / use crypto.getRandomValues」與實作不符 | 已改寫為與實作一致的正確說明 |
| 長度 | 固定 12 | 預設 16(`length = 16` 選填參數,既有呼叫端不受影響) |
| 字元集 | 大小寫+數字,排除易混淆字元,無符號 | **維持不變**(排除 0/O、1/l/I、i、o;依專案既有「電話口述」設計不含符號) |
| 大小寫+數字保證 | 有(required 三槽 + 洗牌) | **維持**(required 三槽 + 加密級 Fisher–Yates 洗牌) |

### 實作說明（為何不直接照搬 spec 參考碼)

Spec 提供的參考實作是「純 rejection sampling」、**不保證**輸出含各類別字元,且字元集加入符號 `!@#$%^&*`、長度 16。為避免破壞既有呼叫端契約,做了兩點原則性調整(其餘照 spec:CSPRNG + rejection sampling):

1. **保留「至少一個大寫 / 小寫 / 數字」保證** — 這是**必要的相容性修正**。
   兩個 server action 都會用 zod 重新驗證產生的密碼:
   - `adminCreateUser` → `createUserSchema.password`(`.regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/)`)
   - `resetUserPassword` → `adminResetPasswordSchema`(`passwordRule`,同樣三條 regex)
   純 rejection sampling 從約 55 字元集抽 16 字,**約 12% 機率不含任何數字**,會反被自家伺服器驗證以「密碼需含數字」擋下 — 即 spec 要求我檢查的「呼叫端依賴原回傳格式而被破壞」。故沿用原本的「3 個保證字元 + 填充 + 洗牌」結構,確保 100% 通過驗證。
2. **字元集維持無符號** — 依 `auth.ts` 既有註解的設計意圖(「方便電話口述」),且 `passwordRule` 並未要求符號;為「零決策 / 最小行為變更」保留現狀。
   > 若資安/資訊部偏好加入符號以提高強度,這是低風險的一行字元集調整,可後續再決定。
3. `randomBelow(n)` 採通用多位元組實作(依範圍取 1+ bytes),對任意 n ≥ 1 皆正確、**不會無限迴圈**(避免單一位元組版在 n>256 時的 foot-gun)。

### 驗證(本次已做)

- ✅ `npm run typecheck` 通過(過程中修掉一個 `Uint8Array` `for...of` 需 `downlevelIteration` 的型別錯誤,改為索引式 for 迴圈,**未改動 tsconfig**)。
- ✅ `npm run lint` 通過(No ESLint warnings or errors)。
- ✅ `npm run build` 通過(含 `/settings/users/new`、`/settings/users/[id]/edit` 兩條使用此函式的路由)。
- ✅ 全 repo `grep "Math.random"` → **0 筆**(密碼/token/驗證碼路徑已無弱亂數殘留)。
- ✅ 演算法統計實測(200,000 次,以相同邏輯在 Node 跑):長度恆為 16、字元集 0 個非法字元(無符號/無混淆字元)、**通過 `passwordRule` 失敗數 0/0/0**(每筆皆含大小寫與數字)、抽樣 50k 無重複。
- ✅ `randomBelow` 卡方均勻度檢定(p=0.001)在 rejection 關鍵情形(`256 % n ≠ 0`:n=7、55、255)與整除情形(n=8、256)**全部 PASS**,確認**無 modulo bias**。
- ℹ️ 註:單字元跨類別頻率有約 1.32 的 max/min 落差,**屬「保證一個數字」結構造成**(數字集僅 8 字且每筆保證出現一次),**非取樣偏差**;隔離測試的 `randomBelow` 本身為均勻。

### 測試（單元測試)

- 專案目前**無測試框架**(`package.json` 無 jest / vitest)。依 spec 指示,本次**不**為此安裝設定測試框架。
- 👉 **此函式的單元測試留待 Stage 3 一併建立**(屆時驗證:長度正確、兩次產生不相等、輸出僅含允許字元集、必含大小寫+數字)。

---

## npm 套件(非破壞性修補)

- **指令**：`npm audit fix`(**未使用 `--force`**;未手動升級 next)。
- **修掉的套件(皆 Stage 0 點名、可非破壞性處理)**:
  | 套件 | 修正前 | 修正後 | 嚴重度 |
  |---|---|---|---|
  | `ws` | 8.20.0 | **8.21.0** | moderate(Uninitialized memory disclosure) |
  | `brace-expansion` | 1.1.x / 2.0.x / 5.0.x(含漏洞) | **1.1.14 / 2.1.0 / 5.0.6** | moderate(ReDoS) |
- **變更檔案**:僅 `package-lock.json`(6 insertions / 6 deletions);`package.json` 的相依宣告**未變動** → 確認為純 transitive 鎖定升級,非破壞性。
- **next 未變動**:✅ 仍為 **14.2.35**(`require('next/package.json').version` 確認)。
- **`npm run build`**:✅ **通過**。

### audit 前後對照

| 嚴重度 | 修正前 | 修正後 | 差異 |
|---|---|---|---|
| critical | 0 | 0 | — |
| **high** | 4 | 4 | 未變(全為 Next.js 叢集,需 `next@16` breaking,留待 Stage 2) |
| **moderate** | 3 | **1** | **−2**(ws、brace-expansion 已解) |
| low / info | 0 | 0 | — |
| **total** | **7** | **5** | **−2** |

- **仍留存(5 筆,皆需破壞性升級,本次刻意不碰)**:`next`(direct, high)、`eslint-config-next`(direct, high)、`@next/eslint-plugin-next`(high)、`glob`(high)、`postcss`(moderate)。→ 全屬 Stage 0 標記的 **P1「Next.js 升級評估」**,須另行排程相容性測試。
- 原始輸出存檔:修補後 `docs/security/npm-audit-after.json`;修補前 `docs/security/npm-audit-raw.json`(Stage 0)。

---

## 本次未觸碰(刻意)

- Next.js / postcss 升級(P1,需 `next@16` major,Stage 2 另評估)
- 上傳檔案內容嗅探(P2)、CSV formula injection(P2)、phone 反查列舉(P2)、`select('*')` 最小揭露(P2)
- 任何 RLS / bucket / 金鑰設定
- `tsconfig.json` 等專案設定檔(僅在不改設定的前提下調整程式碼以通過型別檢查)

---

## 變更檔案清單

| 檔案 | 變更 |
|---|---|
| `lib/validators/auth.ts` | 改寫 `generateRandomPassword()` 為 CSPRNG + rejection sampling,新增 `randomBelow()` helper,修正誤導註解 |
| `package-lock.json` | `npm audit fix` 升級 `ws`、`brace-expansion`(transitive) |
| `docs/security/stage1a-changelog.md` | 本紀錄(新增) |
| `docs/security/npm-audit-after.json` | 修補後 audit 原始輸出(新增,供前後對照) |
