'use client'

import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Bell,
  BellOff,
  Check,
  Copy,
  LogOut,
  Share,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  SquarePlus,
  Trash2,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  Button,
  Card,
  cx,
  ErrorBanner,
  Field,
  inputCls,
  PageHeader,
  Pill,
  Skeleton,
  timeAgo,
  useAdminData,
} from '@/components/admin/ui'

type Settings = {
  contact: { email: string; phone: string }
  notify: { signup: boolean; support: boolean; billing: boolean }
  cronConfigured: boolean
  vapidConfigured: boolean
}

type Device = { key: string; label: string; ua: string; created_at: string; last_sent_at: string | null; endpoint_host: string }

export default function SettingsPage() {
  const settings = useAdminData<Settings>('/api/admin/settings')
  return (
    <div>
      <PageHeader title="Settings & security" />
      <ErrorBanner message={settings.error} onRetry={settings.reload} />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <NotificationsCard settings={settings.data} reloadSettings={settings.reload} />
        </div>
        <div className="space-y-4">
          <TwoFactorCard />
          <SessionsCard />
          <ContactCard settings={settings.data} onSaved={settings.reload} />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- notifications */

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function deviceKeyFor(endpoint: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return 'admin_push:' + hex.slice(0, 32)
}

function defaultLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

type Env = { ios: boolean; standalone: boolean; supported: boolean; permission: NotificationPermission | 'unsupported' }

function readEnv(): Env {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return { ios, standalone, supported, permission: 'Notification' in window ? Notification.permission : 'unsupported' }
}

function NotificationsCard({ settings, reloadSettings }: { settings: Settings | null; reloadSettings: () => void }) {
  const { toast } = useAdmin()
  const devices = useAdminData<{ devices: Device[] }>('/api/admin/push')
  const [env, setEnv] = useState<Env | null>(null)
  const [thisKey, setThisKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const detect = useCallback(async () => {
    const e = readEnv()
    setEnv(e)
    if (!e.supported) return
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      setThisKey(sub ? await deviceKeyFor(sub.endpoint) : null)
    } catch {
      setThisKey(null)
    }
  }, [])

  useEffect(() => {
    // Reads browser APIs (not available during SSR), then sets state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void detect()
  }, [detect])

  const registered = !!thisKey && !!devices.data?.devices.some((d) => d.key === thisKey)

  async function enable() {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapid) return toast('error', 'VAPID key missing on the server')
    setBusy('enable')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        toast('error', perm === 'denied' ? 'Notifications are blocked. Allow them in Settings for this app.' : 'Permission not granted')
        return
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) }))
      const r = await adminFetch('/api/admin/push', { method: 'POST', body: { subscription: sub.toJSON(), label: defaultLabel() } })
      if (!r.ok) throw new Error(r.data.error ?? 'Failed to save device')
      toast('success', 'Notifications are on for this device')
      await detect()
      void devices.reload()
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    setBusy('test')
    const r = await adminFetch<{ sent: number }>('/api/admin/push/test', { method: 'POST' })
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast(r.data.sent ? 'success' : 'error', r.data.sent ? `Sent to ${r.data.sent} device(s)` : 'No device accepted the notification')
    void devices.reload()
  }

  async function remove(d: Device) {
    setBusy(d.key)
    const r = await adminFetch('/api/admin/push', { method: 'DELETE', body: { key: d.key } })
    if (r.ok && d.key === thisKey) {
      // Also drop the browser-side subscription for this device.
      try {
        const reg = await navigator.serviceWorker.getRegistration('/')
        const sub = await reg?.pushManager.getSubscription()
        await sub?.unsubscribe()
      } catch {}
      setThisKey(null)
    }
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', 'Device removed')
    void devices.reload()
  }

  async function togglePref(k: keyof Settings['notify']) {
    if (!settings) return
    setBusy(`pref-${k}`)
    const r = await adminFetch('/api/admin/settings', { method: 'PATCH', body: { notify: { [k]: !settings.notify[k] } } })
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    reloadSettings()
  }

  const needsInstall = env?.ios && !env.standalone

  return (
    <Card title={<span className="flex items-center gap-2"><Bell className="w-4 h-4" /> Push notifications</span>}>
      {!env ? (
        <Skeleton className="h-24" />
      ) : needsInstall ? (
        <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900 space-y-2 mb-4">
          <div className="font-medium">On iPhone, install the admin app first</div>
          <ol className="space-y-1.5 text-[13px]">
            <li className="flex gap-2"><span className="font-semibold">1.</span> Open this page in <b>Safari</b> (cup site → /admin).</li>
            <li className="flex gap-2"><span className="font-semibold">2.</span> Tap <Share className="inline w-4 h-4 -mt-0.5" /> <b>Share</b>, then <SquarePlus className="inline w-4 h-4 -mt-0.5" /> <b>Add to Home Screen</b>.</li>
            <li className="flex gap-2"><span className="font-semibold">3.</span> Open <b>Cup Admin</b> from your home screen, sign in, come back here and tap <b>Turn on notifications</b>.</li>
          </ol>
          <div className="text-[11px] text-sky-800/80">Needs iOS 16.4 or newer. Apple only allows web push for apps added to the home screen.</div>
        </div>
      ) : !env.supported ? (
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-sm text-zinc-700 mb-4">This browser doesn’t support push notifications.</div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {registered ? <Bell className="w-5 h-5 text-emerald-600" /> : <BellOff className="w-5 h-5 text-zinc-400" />}
            <div className="min-w-0">
              <div className="text-sm font-medium">{registered ? 'On for this device' : 'Off for this device'}</div>
              <div className="text-xs text-zinc-500">
                {env.permission === 'denied' ? 'Blocked. Allow notifications for this app in system settings.' : registered ? 'You’ll get alerts on the lock screen.' : 'Turn on to get alerts here.'}
              </div>
            </div>
          </div>
          {registered ? (
            <Button size="sm" loading={busy === 'test'} onClick={test}>
              Send test
            </Button>
          ) : (
            <Button size="sm" variant="primary" loading={busy === 'enable'} disabled={env.permission === 'denied' || settings?.vapidConfigured === false} onClick={enable}>
              Turn on notifications
            </Button>
          )}
        </div>
      )}

      <div className="text-xs font-medium text-zinc-700 mb-1.5">Notify me about</div>
      <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 mb-4">
        {(
          [
            ['signup', 'New café waiting for approval'],
            ['support', 'New support message (max 1 per café every 2 min)'],
            ['billing', 'Daily check at 09:00: trials/subscriptions ending or expired'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm cursor-pointer">
            <span className="text-zinc-700">{label}</span>
            <Toggle on={!!settings?.notify[k]} disabled={!settings || busy === `pref-${k}`} onChange={() => togglePref(k)} />
          </label>
        ))}
      </div>
      {settings && !settings.cronConfigured && settings.notify.billing && (
        <div className="text-[11px] text-amber-700 -mt-2 mb-4">The daily check needs CRON_SECRET set in Vercel (see docs/admin.md).</div>
      )}

      <div className="text-xs font-medium text-zinc-700 mb-1.5">Devices</div>
      {devices.loading && !devices.data ? (
        <Skeleton className="h-12" />
      ) : !devices.data?.devices.length ? (
        <div className="text-sm text-zinc-500">No devices yet.</div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {devices.data.devices.map((d) => (
            <li key={d.key} className="flex items-center gap-3 px-3 py-2.5">
              <Smartphone className="w-4 h-4 text-zinc-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm flex items-center gap-1.5">
                  {d.label} {d.key === thisKey && <Pill className="bg-emerald-100 text-emerald-800">this device</Pill>}
                </div>
                <div className="text-[11px] text-zinc-500">
                  added {timeAgo(d.created_at)}
                  {d.last_sent_at ? ` · last alert ${timeAgo(d.last_sent_at)}` : ''}
                </div>
              </div>
              <button onClick={() => remove(d)} disabled={busy === d.key} className="p-1.5 rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600" title="Remove">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={cx('relative w-10 h-6 rounded-full transition shrink-0 disabled:opacity-50', on ? 'bg-zinc-900' : 'bg-zinc-300')}
    >
      <span className={cx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', on ? 'start-[18px]' : 'start-0.5')} />
    </button>
  )
}

/* ------------------------------------------------------------------- 2FA */

function TwoFactorCard() {
  const { toast } = useAdmin()
  const status = useAdminData<{ enabled: boolean; enabledAt: string | null; resetSwitch: boolean }>('/api/admin/2fa')
  const [enrol, setEnrol] = useState<{ secret: string; uri: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)

  async function begin() {
    setBusy(true)
    const r = await adminFetch<{ secret: string; uri: string }>('/api/admin/2fa', { method: 'POST', body: { action: 'begin' } })
    setBusy(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    setEnrol(r.data)
    setCode('')
  }

  async function confirm() {
    setBusy(true)
    const r = await adminFetch('/api/admin/2fa', { method: 'POST', body: { action: 'confirm', code } })
    setBusy(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', '2FA is on. You’ll need a code at every sign-in.')
    setEnrol(null)
    setCode('')
    void status.reload()
  }

  async function disable() {
    setBusy(true)
    const r = await adminFetch('/api/admin/2fa', { method: 'POST', body: { action: 'disable', code } })
    setBusy(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', '2FA turned off')
    setDisableOpen(false)
    setCode('')
    void status.reload()
  }

  const s = status.data

  return (
    <Card title={<span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Two-factor sign-in</span>}>
      {!s ? (
        <Skeleton className="h-16" />
      ) : s.resetSwitch ? (
        <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900">
          <b>ADMIN_2FA_RESET is set</b>, so 2FA is bypassed. Remove that variable in Vercel and redeploy, then set 2FA up again.
        </div>
      ) : s.enabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Pill className="bg-emerald-100 text-emerald-800"><Check className="w-3 h-3" /> On</Pill>
            <span className="text-zinc-500">since {s.enabledAt ? new Date(s.enabledAt).toLocaleDateString('en-GB') : '—'}</span>
          </div>
          {!disableOpen ? (
            <Button size="sm" variant="ghost" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="w-3.5 h-3.5" /> Turn off
            </Button>
          ) : (
            <div className="flex gap-2">
              <input className={cx(inputCls, 'tracking-[0.3em] tabular-nums')} inputMode="numeric" maxLength={6} placeholder="Current code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <Button variant="danger" disabled={code.length !== 6} loading={busy} onClick={disable}>
                Turn off
              </Button>
            </div>
          )}
        </div>
      ) : !enrol ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">
            <span className="text-red-600 font-medium">Off.</span> Anyone with the admin password can get in. Turn it on so sign-in also needs a 6-digit code from your phone.
          </p>
          <Button variant="primary" loading={busy} onClick={begin}>
            Set up 2FA
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <ol className="text-sm text-zinc-700 space-y-1">
            <li>1. Scan this QR code with an authenticator app (iPhone Passwords, Google Authenticator, 1Password…). On this iPhone you can tap <b>Open in authenticator</b> instead.</li>
            <li>2. Enter the 6-digit code it shows.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="p-2 bg-white border border-zinc-200 rounded-lg">
              <QRCodeSVG value={enrol.uri} size={164} />
            </div>
            <div className="space-y-2 w-full">
              <a href={enrol.uri} className="flex items-center justify-center h-9 rounded-lg border border-zinc-300 text-sm hover:bg-zinc-50">
                Open in authenticator
              </a>
              <button
                onClick={() => navigator.clipboard?.writeText(enrol.secret).then(() => toast('info', 'Secret copied'))}
                className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-zinc-300 text-xs font-mono hover:bg-zinc-50 break-all"
                title="Copy secret for manual entry"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" /> {enrol.secret.match(/.{1,4}/g)?.join(' ')}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input className={cx(inputCls, 'tracking-[0.3em] tabular-nums')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <Button variant="primary" disabled={code.length !== 6} loading={busy} onClick={confirm}>
              Turn on
            </Button>
          </div>
          <button onClick={() => setEnrol(null)} className="text-xs text-zinc-500 hover:underline">
            Cancel
          </button>
        </div>
      )}
    </Card>
  )
}

/* -------------------------------------------------------------- sessions */

function SessionsCard() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useAdmin()

  async function run() {
    setBusy(true)
    const r = await adminFetch('/api/admin/session', { method: 'DELETE' })
    setBusy(false)
    if (!r.ok) {
      setOpen(false)
      return toast('error', r.data.error ?? 'Failed')
    }
    // Full reload: this session was just revoked too.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/admin/login'
  }

  return (
    <Card title={<span className="flex items-center gap-2"><LogOut className="w-4 h-4" /> Sessions</span>}>
      <p className="text-sm text-zinc-600 mb-3">Sign-ins last 7 days. Lost a phone or think someone else is logged in? Sign out everywhere, including here.</p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Log out all devices
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={run}
        loading={busy}
        title="Log out all devices?"
        description="Every admin session ends now, including this one. Notification devices stay registered."
        confirmLabel="Log out everywhere"
      />
    </Card>
  )
}

/* --------------------------------------------------------------- contact */

function ContactCard({ settings, onSaved }: { settings: Settings | null; onSaved: () => void }) {
  if (!settings) return <Skeleton className="h-40" />
  return <ContactForm key={`${settings.contact.email}|${settings.contact.phone}`} initial={settings.contact} onSaved={onSaved} />
}

function ContactForm({ initial, onSaved }: { initial: Settings['contact']; onSaved: () => void }) {
  const { toast } = useAdmin()
  const [email, setEmail] = useState(initial.email)
  const [phone, setPhone] = useState(initial.phone)
  const [busy, setBusy] = useState(false)
  const dirty = email !== initial.email || phone !== initial.phone

  async function save() {
    setBusy(true)
    const r = await adminFetch('/api/admin/settings', { method: 'PATCH', body: { contact: { email, phone } } })
    setBusy(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', 'Support contact saved')
    onSaved()
  }

  return (
    <Card title="Support contact">
      <p className="text-xs text-zinc-500 mb-3">Shown to cafés whose trial or subscription ended.</p>
      <div className="space-y-3">
        <Field label="Email">
          <input className={inputCls} type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Phone / WhatsApp">
          <input className={inputCls} inputMode="tel" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button variant="primary" disabled={!dirty} loading={busy} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  )
}
