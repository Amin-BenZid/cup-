'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'
import { apiErrorText } from '@/lib/i18n/api-error'
import { typeShopCode } from '@/lib/shop-code'
import ForgotPin from '@/components/ForgotPin'

export default function BaristaLogin() {
  const t = useT()
  const router = useRouter()
  
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [forgotOpen, setForgotOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      // Fast path: cached identity.
      if (localStorage.getItem('shop_id')) {
        router.replace('/barista/dashboard')
        return
      }

      // Slow path: the HttpOnly cookie may still be valid even when local
      // storage is empty (new tab, cleared storage, another device).
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          if (json.shop?.id) {
            localStorage.setItem('shop_id', json.shop.id)
            localStorage.setItem('shop_name', json.shop.name ?? '')
            if (!cancelled) router.replace('/barista/dashboard')
            return
          }
        }
      } catch {}

      if (!cancelled) setChecking(false)
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (code.length < 3) {
      setError(t('setup.error.codeLength'))
      return
    }
    if (pin.length !== 6) {
      setError(t('setup.error.pinLength'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, pin }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (json.status === 'pending') {
          localStorage.setItem('shop_id', json.shop_id)
          localStorage.setItem('shop_name', json.shop_name)
          router.push('/pending')
          return
        }
        if (json.status === 'disabled') {
          setError(t('login.error.disabled'))
          return
        }
              if (json.status === 'expired') {
          localStorage.setItem('shop_id', json.shop_id ?? '')
          localStorage.setItem('shop_name', json.shop_name ?? '')
          localStorage.setItem('shop_expired_reason', json.reason ?? 'trial')
          router.push('/expired')
          return
        }
        
        setError(apiErrorText(t, json, 'login.error.failed'))
        setPin('')
        return
      }

      localStorage.setItem('shop_id', json.shop.id)
      localStorage.setItem('shop_name', json.shop.name)
      localStorage.setItem('shop_code', json.shop.code)
      router.push('/barista/dashboard')
    } catch (e) {
      setError(t('setup.error.network'))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#faf7f2] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col transition-colors duration-300">
      <header className="px-6 pt-8 pb-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition -ms-1.5"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('setup.back')}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 px-6 pb-10">
        <div className="max-w-md mx-auto pt-6 space-y-10">
          <div className="space-y-3">
            <BrandLogo size={44} />
            <h1 className="text-3xl font-semibold tracking-tight pt-2">
              {t('login.title')}
            </h1>
            <p className="text-stone-500 text-[15px] leading-relaxed">
              {t('login.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* SHOP CODE INPUT */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-900">
                {t('setup.codeLabel')}
              </label>
              <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(typeShopCode(e.target.value))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t('setup.codePlaceholder')}
                className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition font-mono"
              />
            </div>

            {/* PIN INPUT */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-stone-900">
                  {t('setup.pinLabel')}
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm text-stone-500 hover:text-stone-900 underline underline-offset-2"
                >
                  {t('forgot.link')}
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder={t('setup.pinPlaceholder')}
                maxLength={6}
                className="w-full px-4 py-4 rounded-2xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-center text-2xl tracking-[0.4em] font-mono tabular-nums transition"
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl transition-all">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 3 || pin.length !== 6}
              className="w-full py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 disabled:opacity-40 active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('login.button')
              )}
            </button>

            <p className="text-xs text-stone-400 text-center">
              {t('login.newShop')}{' '}
              <Link
                href="/setup"
                className="text-stone-700 underline underline-offset-2"
              >
                {t('login.setupLink')}
              </Link>
            </p>
          </form>
        </div>
      </div>

      {forgotOpen && <ForgotPin initialCode={code} onClose={() => setForgotOpen(false)} />}

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <BrandLogo size={14} />
          <span>{t('login.footer')}</span>
        </div>
      </footer>
    </main>
  )
}