'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'
import { apiErrorText } from '@/lib/i18n/api-error'
import { typeShopCode } from '@/lib/shop-code'

export default function SetupPage() {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError(t('setup.error.nameRequired'))
    if (code.length < 3) return setError(t('setup.error.codeLength'))
    if (pin.length !== 6) return setError(t('setup.error.pinLength'))

    setLoading(true)
    try {
      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim(), pin }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(apiErrorText(t, json, 'setup.error.failedCreate'))
        return
      }

      localStorage.setItem('shop_id', json.shop.id)
      localStorage.setItem('shop_name', json.shop.name)
      localStorage.setItem('shop_code', json.shop.code)
      router.push('/pending')
    } catch (e) {
      setError(t('setup.error.network'))
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate code from name
  function handleNameChange(val: string) {
    setName(val)
    if (!code || code === name.toLowerCase().replace(/\s+/g, '-')) {
      setCode(val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    }
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
              {t('setup.title')}
            </h1>
            <p className="text-stone-500 text-[15px] leading-relaxed">
              {t('setup.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* SHOP NAME */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-900">
                {t('setup.nameLabel')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('setup.namePlaceholder')}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition"
              />
            </div>

            {/* CAFÉ CODE */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-900">
                {t('setup.codeLabel')}
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(typeShopCode(e.target.value))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t('setup.codePlaceholder')}
                className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition font-mono"
              />
              <p className="text-xs text-stone-500">
                {t('setup.codeHint')}
              </p>
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-900">
                {t('setup.pinLabel')}
              </label>
              <div className="relative">
                <KeyRound className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder={t('setup.pinPlaceholder')}
                  maxLength={6}
                  className="w-full ps-11 pe-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm tracking-[0.4em] font-mono transition"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl transition-all">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 disabled:opacity-50 active:scale-[0.99] transition"
            >
              <span>{loading ? t('setup.creating') : t('setup.create')}</span>
              <ArrowRight className="w-4 h-4 opacity-60 rtl:rotate-180" />
            </button>

            <p className="text-xs text-stone-400 text-center">
              {t('setup.haveAccount')}{' '}
              <Link
                href="/barista"
                className="text-stone-700 underline underline-offset-2"
              >
                {t('setup.loginLink')}
              </Link>
            </p>
          </form>
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <BrandLogo size={14} />
          <span>beep</span>
        </div>
      </footer>
    </main>
  )
}