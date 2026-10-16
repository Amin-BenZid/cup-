'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

export default function SetupPage() {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError(t('setup.error.nameRequired'))
    if (pin.length < 4) return setError(t('setup.error.pinTooShort'))

    setLoading(true)
    try {
      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), pin }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to create shop')
        return
      }

      // Save identity so the pending page can show the shop name
      localStorage.setItem('shop_id', json.shop.id)
      localStorage.setItem('shop_name', json.shop.name)

      // Go to the pending approval screen
      router.push('/pending')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
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
            <CupLogo size={44} />
            <h1 className="text-3xl font-semibold tracking-tight pt-2">
              {t('setup.title')}
            </h1>
            <p className="text-stone-500 text-[15px] leading-relaxed">
              {t('setup.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Field
              label={t('setup.shopName')}
              hint={t('setup.shopNameHint')}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('setup.shopNamePlaceholder')}
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-[15px] transition"
              />
            </Field>

            <Field label={t('setup.pin')} hint={t('setup.pinHint')}>
              <div className="relative">
                <KeyRound className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="••••"
                  maxLength={6}
                  className="w-full ps-11 pe-4 py-3.5 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-[15px] tracking-[0.4em] font-mono transition"
                />
              </div>
            </Field>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
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
          <CupLogo size={14} />
          <span>Cup</span>
        </div>
      </footer>
    </main>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-sm font-medium text-stone-900">{label}</label>
        {hint && <p className="text-xs text-stone-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}