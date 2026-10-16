'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

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
  const t = useT()
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'granted' | 'denied' | 'working'
  >('idle')
  const [error, setError] = useState('')
  const [diag, setDiag] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const supportsSW = 'serviceWorker' in navigator
    const supportsPush = 'PushManager' in window
    const supportsNotif = 'Notification' in window
    const permission = supportsNotif ? Notification.permission : 'unsupported'

    setDiag(
      `SW:${supportsSW} Push:${supportsPush} Notif:${supportsNotif} Perm:${permission}`
    )

    console.log('[NotifSetup] env check', {
      supportsSW,
      supportsPush,
      supportsNotif,
      permission,
      orderId,
    })

    if (!supportsSW || !supportsPush || !supportsNotif) {
      console.warn('[NotifSetup] browser does not support push')
      return
    }

    if (permission === 'granted') {
      setStatus('granted')
      return
    }
    if (permission === 'denied') {
      setStatus('denied')
      return
    }

    if (localStorage.getItem(DISMISS_KEY) === '1') {
      console.log('[NotifSetup] banner previously dismissed')
      return
    }

    console.log('[NotifSetup] showing banner')
    setVisible(true)
  }, [orderId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('[NotifSetup] SW registered'))
      .catch((e) => console.error('[NotifSetup] SW register failed:', e))
  }, [])

  async function enable() {
    setError('')
    setStatus('working')
    try {
      console.log('[NotifSetup] requesting permission')
      const perm = await Notification.requestPermission()
      console.log('[NotifSetup] permission result:', perm)

      if (perm !== 'granted') {
        setStatus('denied')
        return
      }

      console.log('[NotifSetup] awaiting SW ready')
      const reg = await navigator.serviceWorker.ready

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      console.log('[NotifSetup] VAPID public key present:', !!publicKey)
      if (!publicKey) {
        setError('VAPID public key missing (check .env.local)')
        setStatus('idle')
        return
      }

      console.log('[NotifSetup] subscribing to push')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      console.log('[NotifSetup] subscription obtained', sub.endpoint)

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, subscription: sub.toJSON() }),
      })

      console.log('[NotifSetup] server response status:', res.status)

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Failed to save subscription')
        setStatus('idle')
        return
      }

      setStatus('granted')
      setVisible(false)
      console.log('[NotifSetup] subscribed successfully')
    } catch (e) {
      console.error('[NotifSetup] error', e)
      setError(e instanceof Error ? e.message : 'Failed')
      setStatus('idle')
    }
  }

  if (status === 'granted' || status === 'denied') return null
  if (!visible) return null

  return (
    <div className="rounded-xl border p-4 flex items-start gap-3 bg-white"
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
        <p className="text-sm font-medium" style={{ color: 'var(--text, #1c1917)' }}>
          {t('notif.title')}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted, #78716c)' }}>
          {t('notif.body')}
        </p>

        {diag && (
          <p
            className="text-[10px] mt-1 font-mono"
            style={{ color: 'var(--text-muted, #a8a29e)', opacity: 0.6 }}
          >
            {diag}
          </p>
        )}

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
              localStorage.setItem(DISMISS_KEY, '1')
              setVisible(false)
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
          localStorage.setItem(DISMISS_KEY, '1')
          setVisible(false)
        }}
        className="w-6 h-6 rounded-md hover:bg-stone-100 flex items-center justify-center shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted, #a8a29e)' }} />
      </button>
    </div>
  )
}