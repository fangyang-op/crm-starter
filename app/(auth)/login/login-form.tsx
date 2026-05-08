'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import { LogIn, Loader2, Shield, ShieldCheck } from 'lucide-react'

import { login } from './actions'

type Phase = 'idle' | 'loading' | 'success' | 'redirecting'

const SUCCESS_HOLD_MS = 800
const FADE_OUT_MS = 200

export function LoginForm() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // 成功 → 停留 0.8s → 卡片淡出 200ms → router.push('/').
  useEffect(() => {
    if (phase !== 'success') return
    const holdTimer = setTimeout(() => {
      setPhase('redirecting')
      const fadeTimer = setTimeout(() => {
        router.push('/')
        // 預先 refresh 確保 dashboard layout 立刻看到新 session cookie。
        router.refresh()
      }, FADE_OUT_MS)
      // 不需要 cleanup fadeTimer — phase 已是 redirecting,離開頁面 React 會自動清。
      void fadeTimer
    }, SUCCESS_HOLD_MS)
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

  const isSuccess = phase === 'success' || phase === 'redirecting'
  // 動畫:idle/loading 用 #FBE9EF (粉) + Shield 品牌色;success 切到
  // #D1FAE5 (綠) + ShieldCheck 綠色。容器尺寸不變,只換配色與 icon。
  const tileBg = isSuccess ? '#D1FAE5' : '#FBE9EF'

  return (
    <div
      className="relative w-full max-w-[420px]"
      style={{
        opacity: phase === 'redirecting' ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      {/* keyframes — 一次注入,React 解析時 style tag 變成 <style> 元素。
          呼吸脈衝(loading)與打勾彈跳(success)不會同時觸發。*/}
      <style>{`
        @keyframes shield-breath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes check-bounce {
          0%   { transform: scale(0.8); }
          50%  { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* v1.3 §1.3: 圓角方形 tile 半重疊在卡片頂端。位置與尺寸不變,僅
          配色與 icon 隨動畫狀態切換。*/}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: tileBg,
            transition: 'background-color 200ms ease',
          }}
        >
          {/* Shield (idle/loading):loading 階段套呼吸脈衝動畫,success 起淡出。*/}
          <Shield
            size={32}
            strokeWidth={2}
            className="absolute"
            style={{
              color: '#C7315C',
              opacity: isSuccess ? 0 : 1,
              transition: 'opacity 100ms ease',
              animation: phase === 'loading' ? 'shield-breath 1s ease-in-out infinite' : undefined,
            }}
          />
          {/* ShieldCheck (success):淡入 150ms + 一次 300ms 彈跳。
              redirecting 階段保持顯示,等卡片整體淡出。*/}
          <ShieldCheck
            size={32}
            strokeWidth={2}
            className="absolute"
            style={{
              color: '#059669',
              opacity: isSuccess ? 1 : 0,
              transition: 'opacity 150ms ease',
              animation: phase === 'success' ? 'check-bounce 300ms ease-out' : undefined,
            }}
          />
        </div>
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
