'use client'

import { useState } from 'react'
import { Check, Loader2, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/context'
import { apiErrorText } from '@/lib/i18n/api-error'
import { handleAccessDenied } from '@/lib/shop-access-client'

const LATER_MS = 3 * 24 * 60 * 60 * 1000

/** True if the shop pressed "Later" in the last few days on this device. */
export function phonePromptSnoozed(shopId: string): boolean {
  try {
    const at = Number(localStorage.getItem(`phone-prompt-later:${shopId}`) ?? 0)
    return Date.now() - at < LATER_MS
  } catch {
    return false
  }
}

/**
 * Asks a shop with no phone on file for one. It's the number the Beep team
 * calls to verify "forgot PIN" requests, so it can be set once from here;
 * changing it afterwards goes through support.
 */
export default function PhonePrompt({ shopId, onDone }: { shopId: string; onDone: () => void }) {
  const t = useT()
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/shops/${shopId}/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if ((res.status === 401 || res.status === 403) && (await handleAccessDenied(router))) return
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Already set (another device did it): nothing left to ask.
        if (json.code === 'PHONE_ALREADY_SET') return onDone()
        return setError(apiErrorText(t, json, 'common.error'))
      }
      setSaved(true)
      setTimeout(onDone, 1500)
    } catch {
      setError(t('setup.error.network'))
    } finally {
      setBusy(false)
    }
  }

  function later() {
    try {
      localStorage.setItem(`phone-prompt-later:${shopId}`, String(Date.now()))
    } catch {}
    onDone()
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-stone-900 text-amber-50 flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t('phone.title')}</div>
          <p className="text-sm text-stone-500 leading-snug">{t('phone.body')}</p>
        </div>
      </div>

      {saved ? (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5">
          <Check className="w-4 h-4" /> {t('phone.saved')}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d+\s()-]/g, '').slice(0, 20))
                if (error) setError('')
              }}
              placeholder={t('phone.placeholder')}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition tabular-nums rtl:text-end"
            />
            <button
              type="submit"
              disabled={busy || !phone.trim()}
              className="px-4 rounded-xl bg-stone-900 text-amber-50 text-sm font-semibold hover:bg-stone-800 disabled:opacity-40 transition flex items-center justify-center min-w-[96px]"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('phone.save')}
            </button>
          </div>
          {error && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
              {error}
            </div>
          )}
          <button type="button" onClick={later} className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-2">
            {t('phone.later')}
          </button>
        </>
      )}
    </form>
  )
}
