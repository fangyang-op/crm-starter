'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema } from '@/lib/validators/auth'

type Status = 'checking' | 'ready' | 'invalid' | 'success'

const INVALID_EXPIRED = '此重設連結已失效或過期,請重新申請密碼重設。'
const INVALID_NO_SESSION =
  '連結無效或已過期。請從「忘記密碼」信件中的連結重新進入,或重新申請密碼重設。'
const REDIRECT_HOLD_MS = 1400

/** 從 URL(query 或 hash)讀 Supabase 回傳的錯誤;有錯誤代表連結失效 / 被拒。 */
function readUrlAuthError(): boolean {
  if (typeof window === 'undefined') return false
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return Boolean(
    search.get('error') || search.get('error_code') || hash.get('error') || hash.get('error_code'),
  )
}

export function ResetPasswordForm() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [invalidMsg, setInvalidMsg] = useState(INVALID_EXPIRED)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    new_password?: string
    confirm_password?: string
  }>({})

  // ── 偵測 recovery session ──────────────────────────────────────────────
  // 1. URL 帶 error(otp_expired / access_denied …)→ 直接 invalid。
  // 2. 已有 session(/auth/confirm 走 PKCE/token_hash 換好、寫進 cookie)→ ready。
  // 3. hash 流程:browser client 解析 #access_token 後觸發 PASSWORD_RECOVERY → ready。
  // 4. 撐過 fallback 視窗仍無 session → invalid(多半是直接造訪、沒有連結)。
  useEffect(() => {
    if (readUrlAuthError()) {
      setInvalidMsg(INVALID_EXPIRED)
      setStatus('invalid')
      return
    }

    const supabase = createClient()
    let resolved = false
    const markReady = () => {
      if (!resolved) {
        resolved = true
        setStatus('ready')
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') markReady()
      else if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) markReady()
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady()
    })

    const fallback = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setInvalidMsg(INVALID_NO_SESSION)
        setStatus('invalid')
      }
    }, 2500)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(fallback)
    }
  }, [])

  // ── 成功後導回登入頁 ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(() => {
      router.push('/login')
      router.refresh()
    }, REDIRECT_HOLD_MS)
    return () => clearTimeout(t)
  }, [status, router])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setFieldErrors({})

    const parsed = resetPasswordSchema.safeParse({
      new_password: password,
      confirm_password: confirm,
    })
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      setFieldErrors({
        new_password: fe.new_password?.[0],
        confirm_password: fe.confirm_password?.[0],
      })
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    })
    if (updateErr) {
      setError('密碼更新失敗,此重設連結可能已過期。請重新申請密碼重設。')
      setSubmitting(false)
      return
    }

    // 清掉這個暫時的 recovery session,讓使用者用新密碼重新登入。
    await supabase.auth.signOut()
    setStatus('success')
  }

  const isSuccess = status === 'success'
  const isInvalid = status === 'invalid'
  const tileBg = isSuccess ? '#D1FAE5' : isInvalid ? '#FEE2E2' : '#FBE9EF'

  return (
    <div className="relative w-full max-w-[420px]">
      <style>{`
        @keyframes rp-check-bounce {
          0%   { transform: scale(0.8); }
          50%  { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* brand tile half-overlapping the card top — 與登入頁一致 */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
        <div
          className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: tileBg, transition: 'background-color 200ms ease' }}
        >
          {isSuccess ? (
            <ShieldCheck
              size={32}
              strokeWidth={2}
              style={{ color: '#059669', animation: 'rp-check-bounce 300ms ease-out' }}
            />
          ) : isInvalid ? (
            <ShieldAlert size={32} strokeWidth={2} style={{ color: '#B91C1C' }} />
          ) : (
            <Shield size={32} strokeWidth={2} style={{ color: '#C7315C' }} />
          )}
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl bg-white"
        style={{ boxShadow: '0 8px 40px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)' }}
      >
        <div
          className="h-[5px] w-full"
          style={{ background: 'linear-gradient(90deg, #C7315C, #FF6B8A)' }}
        />

        <div className="px-8 pb-8 pt-12">
          {status === 'checking' ? (
            <CheckingState />
          ) : status === 'invalid' ? (
            <InvalidState message={invalidMsg} />
          ) : status === 'success' ? (
            <SuccessState />
          ) : (
            <>
              <header className="space-y-1.5 text-center">
                <h1 className="text-[1.4rem] font-bold leading-tight" style={{ color: '#111827' }}>
                  設定新密碼
                </h1>
                <p className="text-[0.82rem]" style={{ color: '#6B7280' }}>
                  請輸入新的登入密碼,完成後即可使用新密碼登入。
                </p>
              </header>

              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <PasswordField
                  id="new-password"
                  label="新密碼"
                  value={password}
                  onChange={setPassword}
                  show={show}
                  onToggleShow={() => setShow((v) => !v)}
                  autoComplete="new-password"
                  disabled={submitting}
                  error={fieldErrors.new_password}
                />
                <PasswordField
                  id="confirm-password"
                  label="確認新密碼"
                  value={confirm}
                  onChange={setConfirm}
                  show={show}
                  autoComplete="new-password"
                  disabled={submitting}
                  error={fieldErrors.confirm_password}
                />

                <p className="text-[0.72rem]" style={{ color: '#9CA3AF' }}>
                  至少 8 字元,需含大小寫字母與數字。
                </p>

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

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] py-[0.8rem] text-[0.9rem] font-semibold text-white transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#1F2937' }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      更新中…
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      設定新密碼
                    </>
                  )}
                </button>

                <p className="pt-1 text-center text-[0.72rem]">
                  <Link href="/login" className="font-medium" style={{ color: '#C7315C' }}>
                    返回登入頁
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>

      <p
        className="fixed bottom-6 left-1/2 -translate-x-1/2 text-[0.72rem]"
        style={{ color: '#9CA3AF' }}
      >
        © 2026 FangYang International Education Group
      </p>
    </div>
  )
}

function CheckingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Loader2 size={24} className="animate-spin" style={{ color: '#C7315C' }} />
      <p className="text-sm" style={{ color: '#6B7280' }}>
        驗證重設連結中…
      </p>
    </div>
  )
}

function InvalidState({ message }: { message: string }) {
  return (
    <div className="space-y-4 text-center">
      <header className="space-y-1.5">
        <h1 className="text-[1.3rem] font-bold leading-tight" style={{ color: '#111827' }}>
          連結無效或已過期
        </h1>
        <p className="text-[0.85rem] leading-relaxed" style={{ color: '#6B7280' }}>
          {message}
        </p>
      </header>
      <Link
        href="/login"
        className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] py-[0.8rem] text-[0.9rem] font-semibold text-white transition-colors"
        style={{ backgroundColor: '#1F2937' }}
      >
        <LogIn size={16} />
        返回登入頁
      </Link>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="space-y-3 text-center">
      <header className="space-y-1.5">
        <h1 className="text-[1.3rem] font-bold leading-tight" style={{ color: '#065F46' }}>
          密碼已重設
        </h1>
        <p className="text-[0.85rem] leading-relaxed" style={{ color: '#6B7280' }}>
          密碼更新成功,正在帶你回登入頁,請用新密碼登入。
        </p>
      </header>
      <p className="text-[0.72rem]" style={{ color: '#9CA3AF' }}>
        <Link href="/login" className="font-medium" style={{ color: '#C7315C' }}>
          沒有自動跳轉?點此前往登入頁
        </Link>
      </p>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  disabled,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow?: () => void
  autoComplete: string
  disabled?: boolean
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: '#374151' }}>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          className="block w-full rounded-[10px] border-none px-4 py-3 text-[0.9rem] outline-none transition-shadow disabled:cursor-not-allowed disabled:opacity-70"
          style={{ backgroundColor: '#F3F4F6', color: '#111827' }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 2px #C7315C40'
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        {onToggleShow ? (
          <button
            type="button"
            onClick={onToggleShow}
            aria-label={show ? '隱藏密碼' : '顯示密碼'}
            disabled={disabled}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs" style={{ color: '#B91C1C' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
