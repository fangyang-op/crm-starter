# 07. UI 設計系統

> 給 Claude Code 寫前端時的視覺與互動規範。  
> 所有 UI 元件遵循此處規則,避免每次風格漂移。

---

## 1. 設計哲學

- **資訊密度 > 美學裝飾**:CRM 系統,顧問每天看大量資料,介面要快、要清楚
- **冷靜中性,點到為止**:大量中性色,僅關鍵狀態用彩色徽章
- **預設用 shadcn/ui**:不夠用才自製,自製也要符合 shadcn 風格
- **手機優先?不**:本系統以桌機/筆電為主(顧問日常工作場景),不刻意 mobile-first,但 tablet 應可用

---

## 2. 色彩 Palette

### 2.1 主色與中性色

```css
/* 在 app/globals.css 設定 */
:root {
  /* 主色:沉穩藍灰(留學業常見配色,不浮誇) */
  --primary: 222 47% 31%;          /* #2d3e62 深藍灰 */
  --primary-foreground: 210 40% 98%;
  
  /* 強調色:暖橙(用在 CTA 按鈕、重要警示) */
  --accent: 24 95% 53%;            /* #f97316 */
  --accent-foreground: 0 0% 100%;
  
  /* 中性灰階(內容主體) */
  --background: 0 0% 100%;          /* 白底 */
  --foreground: 222 47% 11%;        /* 接近黑 */
  --muted: 210 40% 96%;             /* 淺灰底 */
  --muted-foreground: 215 16% 47%;  /* 中灰文字 */
  --border: 214 32% 91%;            /* 邊框 */
  --input: 214 32% 91%;
  --ring: 222 47% 31%;
  
  /* 卡片 */
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  
  /* 功能色 */
  --destructive: 0 84% 60%;         /* 紅(刪除/錯誤) */
  --destructive-foreground: 210 40% 98%;
  --success: 142 71% 45%;           /* 綠(成功/已成交) */
  --warning: 38 92% 50%;            /* 黃(警示) */
}

/* Dark mode 暫不支援(MVP 階段),Phase 5 之後再說 */
```

### 2.2 學生狀態徽章(13 種)

每個狀態固定一個顏色,**全系統一致**,不要在不同頁用不同色。

| 狀態 | 中文 | 配色(Tailwind class) | 階段 |
|---|---|---|---|
| `new_lead` | 新名單 | `bg-slate-100 text-slate-700 border-slate-300` | 招生 |
| `contacted` | 聯繫中 | `bg-blue-100 text-blue-700 border-blue-300` | 招生 |
| `consulting` | 諮詢中 | `bg-cyan-100 text-cyan-700 border-cyan-300` | 招生 |
| `qualified` | 意向客戶 | `bg-violet-100 text-violet-700 border-violet-300` | 招生 |
| `closed_won` | 已成交 | `bg-emerald-500 text-white border-emerald-600` ⭐ | 分水嶺 |
| `onboarding` | 資料準備 | `bg-teal-100 text-teal-700 border-teal-300` | 申請 |
| `school_selection` | 選校規劃 | `bg-indigo-100 text-indigo-700 border-indigo-300` | 申請 |
| `document_prep` | 書審準備 | `bg-purple-100 text-purple-700 border-purple-300` | 申請 |
| `submitting` | 申請送出 | `bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300` | 申請 |
| `awaiting_decision` | 等待結果 | `bg-amber-100 text-amber-700 border-amber-300` | 申請 |
| `decision_making` | 錄取確認 | `bg-orange-100 text-orange-700 border-orange-300` | 申請 |
| `pre_departure` | 入學準備 | `bg-lime-100 text-lime-700 border-lime-300` | 申請 |
| `enrolled` | 已入學 | `bg-green-700 text-white border-green-800` ✅ | 終止-成功 |
| `paused` | 暫緩 | `bg-yellow-100 text-yellow-700 border-yellow-300` | 特殊 |
| `terminated` | 退費終止 | `bg-red-100 text-red-700 border-red-300` | 終止-失敗 |
| `disqualified` | 無效名單 | `bg-gray-100 text-gray-500 border-gray-300` | 終止-失敗 |

**集中定義位置:** `lib/constants/student-status.ts`

```typescript
export const STUDENT_STATUS_CONFIG = {
  new_lead: { 
    label: '新名單', 
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    stage: 'recruitment' 
  },
  // ... 其他 12 個
} as const
```

---

## 3. 字型 Typography

### 3.1 字型家族

```css
font-family: 
  'Inter',
  '-apple-system', 
  'BlinkMacSystemFont',
  'Segoe UI',
  'PingFang TC',           /* 繁中(Mac) */
  'Microsoft JhengHei',    /* 繁中(Windows) */
  'Noto Sans TC',          /* fallback */
  sans-serif;
```

> 不引入 Google Fonts,避免外部請求。系統字夠用且加載快。

### 3.2 字級與用途

| 場景 | Tailwind | px | 用途 |
|---|---|---|---|
| 頁面大標題 | `text-2xl font-semibold` | 24 | 學生 360°、Dashboard 標題 |
| 區塊標題 | `text-lg font-semibold` | 18 | 卡片標題、Tab 內主標 |
| 小區塊標題 | `text-base font-medium` | 16 | 表單區段標題 |
| 內文 | `text-sm` | 14 | 大部分內文、表格內容 |
| 標籤/說明 | `text-xs text-muted-foreground` | 12 | 表單 label、註解 |
| 數字強調 | `text-3xl font-bold tabular-nums` | 30 | Dashboard KPI 數字 |

### 3.3 中英文混排

- 不使用 letter-spacing 調整中文(無效且難看)
- 中文不用斜體(`font-style: italic` 會變形)
- 英文人名/校名用 `font-medium`(略粗)以區隔

---

## 4. 間距與排版

### 4.1 間距尺度

採用 Tailwind 預設尺度,常用組合:

- 元件內部 padding:`p-3` 或 `p-4`
- 卡片 padding:`p-5` 或 `p-6`
- 區塊間距:`gap-4` 或 `gap-6`
- 頁面外緣留白:`px-6 py-6` (桌機) / `px-4 py-4` (tablet)

### 4.2 主要 Layout

```
┌──────────────────────────────────────────────┐
│  Topbar (h-14, sticky top, border-b)         │
├──────┬───────────────────────────────────────┤
│      │                                        │
│ Side │  Main Content                         │
│ bar  │  - max-w-7xl mx-auto                   │
│      │  - px-6 py-6                           │
│ w-60 │                                        │
│      │                                        │
└──────┴───────────────────────────────────────┘
```

- Sidebar:`w-60`(240px),展開狀態
- Sidebar 摺疊狀態:`w-16`,僅 icon
- Topbar:`h-14`,sticky,white bg + border-bottom

---

## 5. 元件慣例

### 5.1 必裝的 shadcn/ui 元件(最低集合)

```bash
pnpm dlx shadcn@latest add \
  button input label textarea select checkbox radio-group \
  dialog alert-dialog sheet popover tooltip dropdown-menu \
  form table tabs card badge avatar separator \
  toast sonner command \
  calendar date-picker \
  scroll-area accordion
```

### 5.2 自製 Wrapper 元件

放在 `components/shared/`,提供業務語意:

#### `<StatusBadge status="closed_won" />`
- 統一處理 13 個狀態的顏色
- 自動套用 `STUDENT_STATUS_CONFIG`
- 可選 `size` prop:`sm` / `md`

#### `<ConsultantAvatar userId="..." />`
- 顯示頭像 + tooltip(名字)
- 自動 fetch profile

#### `<MoneyDisplay amount={120000} currency="TWD" />`
- 千分號、貨幣符號、tabular-nums
- 例:`NT$ 120,000`

#### `<DateDisplay date="2025-09-01" format="short" />`
- 統一日期格式
- `short`:`2025/09/01`
- `long`:`2025年9月1日`
- `relative`:`3 天前`

#### `<EmptyState icon="..." title="..." description="..." action={...} />`
- 表格無資料時顯示
- 統一風格(中央對齊、灰色 icon、淡色字)

#### `<LoadingSkeleton type="table" rows={5} />`
- 統一 loading 風格(避免 spinner)

---

## 6. 資料表格(Table)樣式

### 6.1 行為慣例

- **預設密度**:`compact`(每列 36-40px 高)
- **hover** 整列淡灰底
- **點擊整列**:導向詳細頁(若適用)
- **右側固定操作欄**:Edit / Delete / More dropdown
- **空狀態**:用 `<EmptyState />`,**永遠**不要顯示空白表格

### 6.2 範例樣式

```jsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[40px]"><Checkbox /></TableHead>
      <TableHead>學生</TableHead>
      <TableHead>狀態</TableHead>
      <TableHead>前端顧問</TableHead>
      <TableHead>後端顧問</TableHead>
      <TableHead className="w-[80px] text-right">操作</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {students.map(s => (
      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
        ...
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## 7. 表單(Form)規範

- **永遠用 `react-hook-form` + `zod`**,搭配 shadcn `<Form>` 元件
- Label 在輸入框上方(不用左右排版)
- 必填欄位 label 後加紅色星號:`<span className="text-destructive">*</span>`
- 錯誤訊息:`text-xs text-destructive mt-1`
- 提交按鈕一律放右下,`Cancel` 在左
- 大表單分區用 `<Card>` 包,每區一個標題

---

## 8. 對話框(Dialog)使用準則

| 操作 | 元件 |
|---|---|
| 確認危險操作(刪除、終止) | `<AlertDialog>` |
| 編輯資料(中型表單) | `<Dialog>` |
| 編輯資料(大型表單) | 不用 dialog,直接導向新頁 |
| 側邊快速檢視 | `<Sheet>`(右側滑出) |
| 簡短提示 | `<Toast>` / `<Sonner>` |

---

## 9. 圖示系統

- 一律用 [`lucide-react`](https://lucide.dev)
- 預設大小:`size={16}`(內文)/ `size={20}`(導覽)/ `size={14}`(徽章內)
- 顏色:預設繼承 `currentColor`
- 不混用其他 icon 庫(Heroicons / Phosphor 等)

---

## 10. 動畫與 Loading

- 微互動:`transition-colors` / `transition-all duration-150`
- Loading:**用 skeleton,不要 spinner**(spinner 給 < 100ms 的 inline 操作)
- Toast 出現:預設 shadcn,滑入 + 淡出
- Page transition:不做(會讓使用者覺得慢)

---

## 11. 鍵盤友善

- 所有可互動元素必須鍵盤可達(Tab 順序合理)
- 表格列支援 Arrow Up/Down 移動(Phase 5 加強)
- 全域搜尋(`Cmd+K` / `Ctrl+K`)用 shadcn `<Command>` 實作

---

## 12. 一致性檢查清單(每次寫 UI 前自問)

- [ ] 用了 shadcn/ui 原生或我自製的 wrapper?
- [ ] 顏色從 CSS 變數讀,沒有寫死 `#xxx`?
- [ ] 狀態徽章用 `<StatusBadge>`,沒自己 inline 寫色?
- [ ] 日期顯示用 `<DateDisplay>`?
- [ ] 金額用 `<MoneyDisplay>`?
- [ ] Loading 是 skeleton?
- [ ] 空狀態有 `<EmptyState>`?
- [ ] 字級用 Tailwind class,不寫 inline style?
- [ ] 圖示來自 lucide-react?
