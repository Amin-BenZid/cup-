'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, Lock, ShieldCheck } from 'lucide-react'
import CupLogo from '@/components/CupLogo'

function safeNext(raw: string | null) {
  // Only allow in-app admin paths (no open redirects).
  return raw && raw.startsWith('/admin') && !raw.startsWith('//') ? raw : '/admin'
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = safeNext(params.get('next'))

  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/login', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setTwoFactor(!!j.twoFactor))
      .catch(() => setTwoFactor(true))
    // Already logged in? Skip the form.
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => {
        if (r.ok) router.replace(next)
      })
      .catch(() => {})
  }, [router, next])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (twoFactor && !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app')
      codeRef.current?.focus()
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (typeof json.twoFactor === 'boolean') setTwoFactor(json.twoFactor)
        setError(json.error ?? 'Login failed')
        setCode('')
        return
      }
      router.replace(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <CupLogo size={36} />
          <div>
            <div className="text-base font-semibold text-zinc-900">Cup Admin</div>
            <div className="text-xs text-zinc-500">Sign in to the control panel</div>
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-zinc-700 mb-1">Password</span>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-lg border border-zinc-300 ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500"
              required
            />
          </div>
        </label>

        {twoFactor && (
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">Authenticator code</span>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full h-11 rounded-lg border border-zinc-300 ps-9 pe-3 text-base tracking-[0.3em] tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500"
              />
            </div>
          </label>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading || !password || twoFactor === null}
          className="w-full h-11 rounded-lg bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </main>
  )
}

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
