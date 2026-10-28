'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { LOCALES } from '@/lib/i18n/translations'

export default function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean
}) {
  const { locale, setLocale, ready, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Before hydration, render a stable placeholder so the SSR and CSR
  // markup match. Once ready, show the real language.
  if (!ready) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-500"
        aria-hidden="true"
      >
        <Globe className="w-4 h-4" />
        {!compact && <span className="hidden sm:inline opacity-0">···</span>}
      </div>
    )
  }

  const current = LOCALES.find((l) => l.id === locale)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition"
        aria-label={t('lang.change')}
      >
        <Globe className="w-4 h-4" />
        {!compact && (
          <span className="hidden sm:inline">{current?.native}</span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 min-w-[180px] bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden z-50">
          {LOCALES.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLocale(l.id)
                setOpen(false)
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-stone-50 transition text-start"
            >
              <div>
                <div className="font-medium text-stone-900">{l.native}</div>
                <div className="text-[11px] text-stone-500">{l.label}</div>
              </div>
              {locale === l.id && (
                <Check className="w-4 h-4 text-stone-900 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}