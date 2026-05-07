'use client'

import { useFormState, useFormStatus } from 'react-dom'

import { LogIn, ShieldCheck } from 'lucide-react'

import { login, type LoginState } from './actions'

const initial: LoginState = {}

export function LoginForm() {
  const [state, formAction] = useFormState(login, initial)

  return (
    <div className="relative w-full max-w-[420px]">
      {/* v1.3 §1.3: ShieldCheck icon sits in a rounded-square tile that
          overlaps the top of the card by half its height. The wrapper is
          absolute so it doesn't push the card down — the card itself just
          gets pt-12 to make room. */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: '#FFF0F3' }}
        >
          <ShieldCheck size={32} strokeWidth={2} style={{ color: '#C7315C' }} />
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

          <form action={formAction} className="mt-8 space-y-4">
            <Field
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              labelZh="員工編號"
              labelEn="Employee ID"
              required
            />
            <Field
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              labelZh="登入密碼"
              labelEn="Password"
              required
            />

            {state.error ? (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  backgroundColor: '#FEE2E2',
                  color: '#B91C1C',
                  border: '1px solid #FECACA',
                }}
              >
                {state.error}
              </div>
            ) : null}

            <SubmitButton />

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
}: {
  id: string
  name: string
  type: string
  autoComplete: string
  labelZh: string
  labelEn: string
  required?: boolean
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
        // §1.6 — flat gray input, no border, focus glow uses brand color at
        // 25% opacity (#C7315C40 = #C7315C with alpha 0x40 ≈ 25%).
        className="block w-full rounded-[10px] border-none px-4 py-3 text-[0.9rem] outline-none transition-shadow"
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

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      // §1.7 — dark ink button, brand-color glow on focus. Inline style for
      // the colors so we don't depend on theme tokens that might shift.
      className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[0.8rem] text-[0.9rem] font-semibold text-white transition-colors disabled:opacity-60"
      style={{ backgroundColor: '#1F2937' }}
      onMouseEnter={(e) => {
        if (!pending) e.currentTarget.style.backgroundColor = '#111827'
      }}
      onMouseLeave={(e) => {
        if (!pending) e.currentTarget.style.backgroundColor = '#1F2937'
      }}
    >
      {pending ? (
        <>登入中…</>
      ) : (
        <>
          <LogIn size={16} />
          立即登入
        </>
      )}
    </button>
  )
}
