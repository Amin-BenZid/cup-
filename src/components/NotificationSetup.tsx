'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { CustomerInstall } from '@/components/InstallApp'
import { useStored } from '@/hooks/useStored'

const noopSubscribe = () => () => {}
function readPermission(): NotificationPermission | 'unsupported' {
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return ok ? Notification.permission : 'unsupported'
}

const DISMISS_KEY = 'notif-banner-dismissed'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export default function NotificationSetup({ orderId }: { orderId: string }) {
  const { t, locale } = useI18n()

  // Dismissal is per order: a new coffee should ask again.
  const dismissKey = `${DISMISS_KEY}-${orderId}`

  // What the browser allows right now ('unsupported' on the server and on
  // browsers without web push, e.g. iPhone before Add to Home Screen).
  const permission = useSyncExternalStore(noopSubscribe, readPermission, () => 'unsupported' as const)
  const dismissedBefore = useStored(dismissKey) === '1'
  // Result of tapping "Enable" (idle until then).
  const [action, setStatus] = useState<'idle' | 'granted' | 'denied' | 'working'>('idle')
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState('')

  const status =
    action !== 'idle' ? action : permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'idle'
  const visible = permission === 'default' && !dismissedBefore && !closed

  // Register the service worker once.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .catch((e) => console.error('[NotifSetup] SW register failed:', e))
  }, [])

  // Permission already granted (earlier visit, dismissed banner, or a lost
  // row): make sure a subscription exists server-side, silently.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    let cancelled = false

    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        let sub = await reg.pushManager.getSubscription()

        if (!sub) {
          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (!publicKey) return
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
        }

        if (cancelled) return

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            subscription: sub.toJSON(),
            locale,
          }),
        }).catch(() => {})
      } catch (e) {
        console.error('[NotifSetup] silent resubscribe failed:', e)
      }
    })()

    return () => {
      cancelled = true
    }
    // Re-sent when the language changes, so the "ready" alert uses it.
  }, [orderId, locale])

  async function enable() {
    setError('')
    setStatus('working')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setStatus('denied')
        return
      }

      const reg = await navigator.serviceWorker.ready

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        setError(t('notif.error.unavailable'))
        setStatus('idle')
        return
      }

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, subscription: sub.toJSON(), locale }),
      })

      if (!res.ok) {
        setError(t('notif.error.save'))
        setStatus('idle')
        return
      }

      setStatus('granted')
      setClosed(true)
    } catch {
      setError(t('notif.error.save'))
      setStatus('idle')
    }
  }

  if (status === 'granted') return null

  if (status === 'denied') {
    return (
      <div className="space-y-2">
        <p
          className="text-[12px] leading-snug"
          style={{ color: 'var(--text-muted, #78716c)' }}
        >
          {t('notif.blocked')}
        </p>
        <CustomerInstall />
      </div>
    )
  }
  if (!visible) {
    // iPhone (not on the Home Screen yet) lands here: alerts need the install.
    return <CustomerInstall />
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl border p-4 flex items-start gap-3 bg-white"
        style={{ borderColor: 'var(--border, #e7e5e4)' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'var(--primary, #1c1917)',
            color: 'var(--primary-text, #fafaf9)',
          }}
        >
          <Bell className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text, #1c1917)' }}
          >
            {t('notif.title')}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: 'var(--text-muted, #78716c)' }}
          >
            {t('notif.body')}
          </p>

          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={enable}
              disabled={status === 'working'}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition"
              style={{
                background: 'var(--primary, #1c1917)',
                color: 'var(--primary-text, #fafaf9)',
              }}
            >
              {status === 'working' ? t('notif.enabling') : t('notif.enable')}
            </button>
            <button
              onClick={() => {
                localStorage.setItem(dismissKey, '1')
                setClosed(true)
              }}
              className="text-xs px-2 py-1.5 hover:opacity-70 transition"
              style={{ color: 'var(--text-muted, #78716c)' }}
            >
              {t('notif.notNow')}
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.setItem(dismissKey, '1')
            setClosed(true)
          }}
          className="w-6 h-6 rounded-md hover:bg-stone-100 flex items-center justify-center shrink-0"
          aria-label={t('common.dismiss')}
        >
          <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted, #a8a29e)' }} />
        </button>
      </div>

      <CustomerInstall />
    </div>
  )
}