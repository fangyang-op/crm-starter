# Stage 3 — 自動化測試套件報告(Phase 1)

日期:2026-06-10
分支:`test/stage3-suite`(獨立分支,off `main`)
目的:把資訊部點名的「Coverage 0% / Tests 0」與「跨角色 RLS 隔離證據」從一次性 UAT 升級為**留在 repo、可重複執行、進 CI** 的自動化測試。本次交付 **Phase 1(安全關鍵 + RLS)**;Phase 2/3 後續。

---

## 1. 框架選型與理由

| 用途 | 框架 | 理由 |
|---|---|---|
| 單元 / 整合 | **Vitest** `^3` | ESM-native、原生 TS、快、零設定即支援本專案的 `@/` alias;內建 V8 coverage。專案原無測試框架,Vitest 是 Next 15 + TS 的標準選擇。 |
| E2E(路由保護 / 流程) | **Playwright** `@playwright/test ^1.60` | 真實瀏覽器 + cookie session,能驗 Next middleware + 頁面層 redirect;支援 webServer、globalSetup/teardown。 |

**測試金鑰原則(已落實)**:RLS 測試一律用 **anon key + 各角色登入後的 session**(authenticated client)— `signInAs(role)`;**service_role 僅用於 seed/teardown fixtures**,絕不用來斷言 RLS。(測試結果本身即證明:顧問只看到 3 筆、主管看到 4 筆——若用了 service_role 繞過 RLS,所有人都會看到全部,差異化結果證明 RLS 確實被測到。)

---

## 2. 已交付測試(Phase 1)

| Phase | 檔案 | 測試數 | 在哪跑 | 狀態 |
|---|---|---|---|---|
| 1A 單元 | `tests/unit/auth.test.ts` | 17 | 沙箱 / CI(免 DB) | ✅ 綠 |
| 1A 單元 | `tests/unit/csv.test.ts` | 10 | 同上 | ✅ 綠 |
| 1A 單元 | `tests/unit/phone.test.ts` | 18 | 同上 | ✅ 綠 |
| 1A 單元 | `tests/unit/file-validation.test.ts` | 7 | 同上 | ✅ 綠 |
| 1A 單元 | `tests/unit/crypto.test.ts` | 5 | 同上 | ✅ 綠 |
| 1A 單元 | `tests/unit/utils.test.ts` | 3 | 同上 | ✅ 綠 |
| 1B RLS 整合 | `tests/integration/rls.integration.test.ts` | 9 | Jo 本機 / CI(需 Supabase) | ✅ 綠(已對真實 Supabase 跑過) |
| 1C 路由 E2E | `tests/e2e/route-protection.spec.ts` | 4 | Jo 本機 / CI(需瀏覽器 + app + Supabase) | ⏳ 已寫,待 CI 跑 |

**單元測試結果(沙箱):60 passed / 60。** 整合測試已對真實 Supabase 測試庫實跑 **9 passed / 9**(seed → 斷言 → teardown,**驗證 teardown 後 0 殘留**,可重複執行)。

---

## 3. 覆蓋率

`npm run test:coverage`(單元,scope = 可單元測的純邏輯 / 安全原語層):

| 檔案 | % Stmts | 說明 |
|---|---|---|
| **All (scoped)** | **92.85%** | csv/phone/utils 100%、auth 97%、file-validation 高、crypto 80% |
| lib/utils.ts(`cn`) | 100% | |
| lib/utils/csv.ts | 100% | CSV injection 中和 |
| lib/utils/phone.ts | 100% | phone normalize / 驗證 |
| lib/utils/file-validation.ts | (7 tests) | 內容嗅探白名單 |
| lib/validators/auth.ts | 96.96% | passwordRule / 密碼產生器 |
| lib/crypto.ts | 79.59% | AES-256-GCM round-trip(未覆蓋:loadKey 的金鑰格式錯誤防禦分支) |

> 誠實聲明:**整體 repo 行覆蓋率仍低**——因為大部分程式是 server actions / RLS / 路由,這些由「整合(9 條)+ E2E(4 條)行為測試」覆蓋,而非單元測試的行覆蓋指標。把它們算進單元 coverage 的 include 會「低估」單元覆蓋,故 scope 在純邏輯層。**Phase 3 會把單元覆蓋往 server actions / 元件擴。**

---

## 4. 測試 ↔ 附錄 C.4 / 資訊部要求 對照

| 資訊部要求 / C.4 | 自動化測試 | 類型 |
|---|---|---|
| C.4 #1 顧問只看自己的學生 | `rls.integration` → "C.4 #1" | 整合(authed client) |
| C.4 #2 直接帶他人 ID → 擋 | `rls.integration` → "C.4 #2" | 整合 |
| C.4 #3 後端顧問隔離 | `rls.integration` → "C.4 #3" | 整合 |
| C.4 #4/#5/#6 consultant 被擋(/settings、/uat/admin、/duplicate-overrides) | `route-protection.spec` → "consultant…" | E2E |
| C.4 #7 主管/admin 看全部 | `rls.integration` → "C.4 #7" | 整合 |
| C.4 #8 電話反查最小揭露(顧問無 PII、主管完整) | `rls.integration` → "C.4 #8 / #8c" | 整合 |
| C.4 #9 Storage signed URL | 設計已驗(Stage 0:bucket Private + 僅 createSignedUrl(60));Phase 2 補下載 E2E | — |
| C.4 #10 顧問不可自助覆寫 | DB 信號於 #8 驗;server-action 閘門由 Phase 2 建檔 E2E + Stage 2-A 對抗式審查 | (Phase 2) |
| settings 表非 admin 不可寫 | `rls.integration` → "lead_sources INSERT rejected" | 整合 |
| 任務四 H 跨角色路由 | `route-protection.spec`(manager/admin) | E2E |
| 密碼安全(弱亂數修補) | `auth.test`(crypto-based、保證類別、無 modulo bias、無碰撞) | 單元 |
| 帳密加密(AES-256-GCM) | `crypto.test`(round-trip、tamper 偵測) | 單元 |
| 上傳內容嗅探 | `file-validation.test`(改名假檔被擋) | 單元 |
| CSV injection | `csv.test`(= + - @ Tab CR 中和) | 單元 |

---

## 5. 如何在本機跑

```bash
# 單元(免 DB,任何環境)
npm run test:unit          # or: npm test
npm run test:coverage      # + 覆蓋率報告 → coverage/

# 整合(RLS)— 需 Supabase 測試庫憑證
cp .env.test.example .env.test   # 填入 TEST_SUPABASE_* + E2E_TEST_PASSWORD
npm run test:integration

# E2E(路由保護)— 需 Supabase + 瀏覽器
npx playwright install chromium
npm run test:e2e
```

`.env.test` 已加入 `.gitignore`(連同 `.env.local`)。憑證填 `.env.test`,**不入 repo**。

---

## 6. CI(GitHub Actions)— `.github/workflows/test.yml`

| Job | 跑什麼 | 需要 secrets? |
|---|---|---|
| `unit` | lint + typecheck + 單元測試 + coverage | **否**(每次 PR/push 必跑、必綠) |
| `integration` | RLS 整合測試 | 是(無 secrets 時自動 skip,exit 0) |
| `e2e` | 安裝 chromium + 路由保護 E2E | 是(無 secrets 時自動 skip) |

### ⚠️ 需 Jo 在 GitHub repo Settings → Secrets and variables → Actions 設定(Agent 不碰 secrets):
- `TEST_SUPABASE_URL` — Supabase **測試**專案 URL
- `TEST_SUPABASE_ANON_KEY` — 測試專案 anon key
- `TEST_SUPABASE_SERVICE_ROLE_KEY` — 測試專案 service_role(僅供 seed/teardown)
- `E2E_TEST_PASSWORD` — 測試帳號共用密碼(任一強密碼;seed 與 E2E login 共用)
- `TEST_ENCRYPTION_KEY` — 32-byte hex(`openssl rand -hex 32`),供 E2E job 的 app server 啟動

> 建議用**專用的 Supabase 測試專案/branch**(無真實個資)。套件 seed/teardown 帶 `t3test_` / 「測試學生_T3」前綴,測完自清。

---

## 7. 注意事項 / 觀察

1. **`/settings` admin-only 基底(已對齊)**:`route-protection.spec` 對 **manager 被擋出 /settings** 的斷言依賴 `settings/layout.tsx` 收緊為 `isAdmin`。該 fix 已 merge 進 `main`(PR #2,`298c078`),且本分支**已 merge 最新 `main`**,基底含 admin-only。此相依已解除,無合併順序問題。
2. **低風險觀察(非本階段修)**:`isValidTaiwanPhone` 的市話 regex `0[2-9]\d{7,8}` 會把 9 碼「09…」當合法市話(9 ∈ [2-9])。已用一條測試**記錄此既有行為**(非斷言修正)。
3. 整合 / E2E 在 Agent 沙箱外跑;但整合測試**已在開發階段對真實 Supabase 測試庫實跑通過**(本報告 §2)。

---

## 8. 移交文件可更新

- **附錄 C.4**:隔離證明從「一次性 UAT」標為「**已自動化**(`tests/integration/rls.integration.test.ts`,每次 CI 重跑)」。
- **§10**:「Coverage 0% / Tests 0」更新為「單元 60 / 整合 9 / E2E 4;純邏輯層 coverage 92.85%」。
- **附錄 A 第 11 項(修補紀錄)**:反映自動化測試套件已建立(Phase 1)。

---

## 9. 後續(Phase 2 / 3,本次未做)

- **Phase 2**:建檔+重複偵測、成交解鎖、上傳(改名假檔被擋)/下載、申請/帳密、CSV 匯出 的 E2E。
- **Phase 3**:把單元覆蓋擴到 server actions / 元件 / 其餘 validators;補 coverage 門檻(CI gate);
- (本套件建立後)Stage 2-C `select('*')` 最小揭露 — 屆時有測試接著改才安全。
