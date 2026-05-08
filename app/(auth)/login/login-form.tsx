'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { LogIn, Loader2 } from 'lucide-react'

import { login } from './actions'

type Phase = 'idle' | 'loading' | 'success' | 'redirecting'

// 成功動畫時序:
//   0–400ms   橘色圓點從灰過渡到橘 + drop-shadow 光暈淡入
//   400–700ms 整個 Logo scale 1 → 1.08 → 1 彈跳
//   700ms 起  停留 600ms
//   1300ms 起 卡片淡出 200ms,然後 router.push('/')
const SUCCESS_COLOR_DURATION_MS = 400
const SUCCESS_BOUNCE_DURATION_MS = 300
const SUCCESS_HOLD_MS = 600
const FADE_OUT_MS = 200

export function LoginForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (phase !== 'success') return
    const totalMs = SUCCESS_COLOR_DURATION_MS + SUCCESS_BOUNCE_DURATION_MS + SUCCESS_HOLD_MS
    const holdTimer = setTimeout(() => {
      setPhase('redirecting')
      const fadeTimer = setTimeout(() => {
        router.push('/')
        // 預先 refresh 確保 dashboard layout 立刻看到新 session cookie。
        router.refresh()
      }, FADE_OUT_MS)
      void fadeTimer
    }, totalMs)
    return () => clearTimeout(holdTimer)
  }, [phase, router])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (phase !== 'idle') return
    setError(null)
    setPhase('loading')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(formData)
      if (!result.ok) {
        setError(result.error)
        setPhase('idle')
        return
      }
      setPhase('success')
    })
  }

  return (
    <div
      className="relative w-full max-w-[420px]"
      style={{
        opacity: phase === 'redirecting' ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      {/* keyframes 一次注入。loading 階段底線波浪;success 階段整體彈跳。
          兩個動畫不會同時觸發 — loading 結束後才會切到 success。*/}
      <style>{`
        @keyframes baseline-wave {
          0%, 100% { transform: translateY(-2px); }
          50%      { transform: translateY(2px); }
        }
        @keyframes logo-bounce {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* 64×64 inline SVG 半重疊在卡片頂端。沒有額外的 tile bg —
          paths 覆蓋足夠面積,在淡色背景上自身就清楚。*/}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        <BrandLogo phase={phase} />
      </div>

      <div
        className="overflow-hidden rounded-2xl bg-white"
        style={{
          // v1.3 §1.5: dual shadow — deeper outer + tight inner — so the card
          // floats over the gradient without looking flat or harsh.
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* §1.2 brand color bar across the top edge of the card */}
        <div
          className="h-[5px] w-full"
          style={{ background: 'linear-gradient(90deg, #C7315C, #FF6B8A)' }}
        />

        <div className="px-8 pb-8 pt-12">
          <header className="space-y-1.5 text-center">
            <h1 className="text-[1.4rem] font-bold leading-tight" style={{ color: '#111827' }}>
              放洋留學 CRM 全端平台
            </h1>
            <p className="text-[0.82rem]" style={{ color: '#6B7280' }}>
              顧問資訊整合中心 · 內部員工登入
            </p>
          </header>

          <form ref={formRef} onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              labelZh="員工編號"
              labelEn="Employee ID"
              required
              disabled={phase !== 'idle'}
            />
            <Field
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              labelZh="登入密碼"
              labelEn="Password"
              required
              disabled={phase !== 'idle'}
            />

            {error ? (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  backgroundColor: '#FEE2E2',
                  color: '#B91C1C',
                  border: '1px solid #FECACA',
                }}
              >
                {error}
              </div>
            ) : null}

            <SubmitButton phase={phase} />

            <p className="pt-1 text-center text-[0.72rem]" style={{ color: '#9CA3AF' }}>
              初次登入請使用員工編號作為密碼,登入後可於設定區修改。
            </p>
          </form>
        </div>
      </div>

      {/* §1.9: pinned copyright. position:fixed so it stays anchored to the
          viewport bottom regardless of card height. */}
      <p
        className="fixed bottom-6 left-1/2 -translate-x-1/2 text-[0.72rem]"
        style={{ color: '#9CA3AF' }}
      >
        © 2026 FangYang International Education Group
      </p>
    </div>
  )
}

/** 品牌 Logo (放洋圖示) inline SVG。保留 4 個 path 的 d 與 fill 與
 *  public/logo.svg 完全一致;唯一動態變化:
 *    - 橘色圓點 fill 在 idle/loading 為灰 (#9CA3AF),success 切回 #FFA534
 *      並透過 filter:drop-shadow 加上光暈
 *    - 底線 path 包在 <g> 內,loading 階段套用 translateY 波浪 keyframes
 *    - success 進入時整個 svg 套一次 logo-bounce(0 + 400ms delay) */
function BrandLogo({ phase }: { phase: Phase }) {
  const isSuccess = phase === 'success' || phase === 'redirecting'
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 175 175"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      // overflow visible 讓 drop-shadow 不被 SVG 邊界裁掉
      style={{
        overflow: 'visible',
        transformOrigin: 'center',
        animation:
          phase === 'success'
            ? `logo-bounce ${SUCCESS_BOUNCE_DURATION_MS}ms ease-out ${SUCCESS_COLOR_DURATION_MS}ms`
            : undefined,
      }}
    >
      <path
        d="M96.6423 94.9507L101.742 79.0577C102.82 75.7006 106.914 74.4475 109.686 76.6266L126.86 90.1303C130.373 92.8923 129.955 98.26 125.596 99.2428C124.109 99.5779 122.539 99.7779 120.981 99.7223C114.543 99.4923 109.254 100.182 102.356 101.562C98.5772 102.192 95.4718 98.5984 96.6423 94.9507Z"
        fill="#FF4B7D"
      />
      <path
        d="M97.3959 38.2504L43.4914 90.796C40.2391 93.9663 43.1035 99.6753 47.6181 99.1778C53.5635 98.5226 60.0657 98.089 64.6451 98.5727C70.1149 99.1505 77.2958 100.912 82.2162 102.245C85.366 103.098 88.6804 101.373 89.6916 98.2701L107.253 44.384C109.189 38.4456 101.868 33.8906 97.3959 38.2504Z"
        fill="#F7005A"
      />
      {/* 橘色「太陽」— idle/loading 顯示為暗灰,success 點亮並加光暈。 */}
      <path
        d="M139.607 64.5409C139.607 68.9857 136.004 72.589 131.559 72.589C127.114 72.589 123.511 68.9857 123.511 64.5409C123.511 60.0961 127.114 56.4929 131.559 56.4929C136.004 56.4929 139.607 60.0961 139.607 64.5409Z"
        fill={isSuccess ? '#FFA534' : '#9CA3AF'}
        style={{
          transition: `fill ${SUCCESS_COLOR_DURATION_MS}ms ease, filter ${SUCCESS_COLOR_DURATION_MS}ms ease`,
          filter: isSuccess ? 'drop-shadow(0 0 6px rgba(255, 165, 52, 0.6))' : 'none',
        }}
      />
      {/* 底線(地平線/水波)— loading 階段上下波動。 */}
      <g
        style={{
          transformOrigin: 'center',
          animation: phase === 'loading' ? 'baseline-wave 1.2s ease-in-out infinite' : undefined,
        }}
      >
        <path
          d="M114.701 109.528C123.287 108.965 131.316 110.025 140.761 112.408L141.68 112.643L141.817 112.68C144.685 113.501 146.391 116.463 145.639 119.368C144.876 122.319 141.865 124.091 138.914 123.328C129.792 120.967 122.753 120.061 115.424 120.542C108.023 121.028 100.007 122.947 88.9372 126.666L87.1529 127.265L85.3744 126.649C75.1573 123.112 67.5552 121.237 60.17 120.682C52.8088 120.129 45.3536 120.865 35.4151 122.929C32.431 123.549 29.5095 121.632 28.8896 118.648C28.2698 115.663 30.1864 112.742 33.1705 112.122C43.6814 109.939 52.2415 109.018 60.9972 109.676C69.2369 110.295 77.3742 112.292 87.2054 115.611C97.8029 112.131 106.372 110.075 114.701 109.528Z"
          fill="#4A4E53"
        />
      </g>
    </svg>
  )
}

function Field({
  id,
  name,
  type,
  autoComplete,
  labelZh,
  labelEn,
  required,
  disabled,
}: {
  id: string
  name: string
  type: string
  autoComplete: string
  labelZh: string
  labelEn: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm">
        <span className="font-medium text-[#374151]">{labelZh}</span>
        <span className="text-[0.7rem]" style={{ color: '#9CA3AF' }}>
          {labelEn}
        </span>
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        // §1.6 — flat gray input, no border, focus glow uses brand color at
        // 25% opacity (#C7315C40 = #C7315C with alpha 0x40 ≈ 25%).
        className="block w-full rounded-[10px] border-none px-4 py-3 text-[0.9rem] outline-none transition-shadow disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          backgroundColor: '#F3F4F6',
          color: '#111827',
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 2px #C7315C40'
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

function SubmitButton({ phase }: { phase: Phase }) {
  const disabled = phase !== 'idle'
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[0.8rem] text-[0.9rem] font-semibold text-white transition-colors disabled:opacity-60"
      style={{ backgroundColor: '#1F2937' }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = '#111827'
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = '#1F2937'
      }}
    >
      {phase === 'loading' ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          登入中…
        </>
      ) : phase === 'success' || phase === 'redirecting' ? (
        <>登入成功</>
      ) : (
        <>
          <LogIn size={16} />
          立即登入
        </>
      )}
    </button>
  )
}
