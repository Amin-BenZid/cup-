'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DEFAULT_LOCALE,
  LOCALES,
  translations,
  type Locale,
  type TranslationKey,
} from './translations'
import { storageChanged, useHydrated, useStored } from '@/hooks/useStored'

const STORAGE_KEY = 'cup-locale'

type Ctx = {
  locale: Locale
  dir: 'ltr' | 'rtl'
  ready: boolean
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The server render and hydration use the default (fr); right after, the
  // saved language takes over. A choice made in this tab wins over both.
  const stored = useStored(STORAGE_KEY)
  const ready = useHydrated()
  const [chosen, setChosen] = useState<Locale | null>(null)
  const storedLocale: Locale | null = stored === 'fr' || stored === 'ar' || stored === 'en' ? stored : null
  const locale: Locale = chosen ?? storedLocale ?? DEFAULT_LOCALE

  const dir = useMemo(
    () => LOCALES.find((l) => l.id === locale)?.dir ?? 'ltr',
    [locale]
  )

  // Apply <html lang>, <html dir>, and the Arabic font class
  useEffect(() => {
    if (typeof document === 'undefined') return

    document.documentElement.lang = locale
    document.documentElement.dir = dir

    if (locale === 'ar') {
      document.body.classList.add('font-arabic')
    } else {
      document.body.classList.remove('font-arabic')
    }
  }, [locale, dir])

  const setLocale = useCallback((l: Locale) => {
    setChosen(l)
    try {
      window.localStorage.setItem(STORAGE_KEY, l)
    } catch {}
    storageChanged()
  }, [])

  const t = useCallback(
    (
      key: TranslationKey,
      values?: Record<string, string | number>
    ): string => {
      const dict = translations[locale] as Record<string, string>
      let str =
        dict[key] ?? (translations.fr as Record<string, string>)[key] ?? key
    if (values) {
  str = str.replace(/%(\w+)/g, (_, k) =>
    values[k] !== undefined ? String(values[k]) : `%${k}`
  )
}
      return str
    },
    [locale]
  )

  const value = useMemo<Ctx>(
    () => ({ locale, dir, ready, setLocale, t }),
    [locale, dir, ready, setLocale, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      dir: 'ltr',
      ready: true,
      setLocale: () => {},
      t: (key) =>
        (translations[DEFAULT_LOCALE] as Record<string, string>)[key] ?? key,
    }
  }
  return ctx
}

export function useT() {
  return useI18n().t
}