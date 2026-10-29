'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell, Check, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { storageChanged, useSnoozed } from '@/hooks/useStored'
import { useInstall } from '@/components/InstallApp'

/**
 * Staff dashboard: lets this phone get a notification when the Beep team
 * replies in Support or posts a broadcast. On iPhone that only works once the
 * dashboard is on the Home Screen; the browser decides, so we just check
 * whether web push exists here.
 */

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
const noopSubscribe = () => () => {}

function readPermission(): NotificationPermission | 'unsupported' {
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return ok ? Notification.permission : 'unsupported'
}

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Subscribe this phone (or reuse its subscription) and tell the server. */
async function registerDevice(shopId: string, locale: string): Promise<boolean> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return false
  await navigator.serviceWorker.register('/sw.js')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  const res = await fetch(`/api/shops/${shopId}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), locale }),
  })
  return res.ok
}

export default function StaffNotifications({ shopId }: { shopId: string }) {
  const { t, locale } = useI18n()
  const permission = useSyncExternalStore(noopSubscribe, readPermission, () => 'unsupported' as const)
  const { available: installAvailable } = useInstall()
  const laterKey = `staff-notif-later:${shopId}`
  const snoozed = useSnoozed(laterKey, SNOOZE_MS)
  const installSnoozed = useSnoozed(`install-card-later:${shopId}`, SNOOZE_MS)
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [closed, setClosed] = useState(false)

  // Already allowed (earlier visit, other tab): make sure the server knows
  // this phone, silently, and in the current language.
  useEffect(() => {
    if (permission !== 'granted') return
    registerDevice(shopId, locale).catch(() => {})
  }, [permission, shopId, locale])

  // One card at a time: while the "Add to Home Screen" card is still offered
  // (not installed, not postponed), that one comes first.
  const installCardShowing = installAvailable && !installSnoozed
  const show =
    state === 'done' || (permission === 'default' && !snoozed && !closed && !installCardShowing)
  if (!show) return null

  async function enable() {
    setState('working')
    try {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        setState('idle')
        setClosed(true)
        return
      }
      const ok = await registerDevice(shopId, locale)
      setState(ok ? 'done' : 'error')
      if (ok) setTimeout(() => setClosed(true), 2000)
    } catch {
      setState('error')
    }
  }

  if (state === 'done' && closed) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t('staffNotif.title')}</div>
          <p className="text-sm text-stone-500 leading-snug">{t('staffNotif.body')}</p>
        </div>
      </div>
      {state === 'done' ? (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5">
          <Check className="w-4 h-4" /> {t('staffNotif.done')}
        </div>
      ) : (
        <>
          {state === 'error' && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
              {t('notif.error.save')}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={enable}
              disabled={state === 'working'}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-stone-900 text-amber-50 text-sm font-semibold hover:bg-stone-800 disabled:opacity-50 transition"
            >
              {state === 'working' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {state === 'working' ? t('notif.enabling') : t('staffNotif.enable')}
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(laterKey, String(Date.now()))
                } catch {}
                storageChanged()
                setClosed(true)
              }}
              className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-2 shrink-0"
            >
              {t('phone.later')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
