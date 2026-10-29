'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Archive, Clock, Loader2, LogOut, Mail, MessageCircle, PauseCircle, Phone, Plus, XCircle } from 'lucide-react'
import BrandLogo from '@/components/BrandLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import SupportModal from '@/components/SupportModal'
import { useT } from '@/lib/i18n/context'
import { useStored } from '@/hooks/useStored'
import { clearShopStorage, fetchAccess, screenFor, type AccessState } from '@/lib/shop-access-client'

type Contact = { email: string; phone: string }
/** The states this screen explains. */
type Shown = 'expired' | 'disabled' | 'archived' | 'deleted'

/**
 * One screen for every "you can't use the dashboard right now" case. The
 * state always comes from the server, never from what the browser remembers.
 */
export default function AccountUnavailablePage() {
  return (
    <Suspense fallback={<Loading />}>
      <AccountUnavailable />
    </Suspense>
  )
}

function Loading() {
  return (
    <main className="min-h-screen bg-[#faf7f2] flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
    </main>
  )
}

function AccountUnavailable() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [shown, setShown] = useState<Shown | null>(params.get('state') === 'deleted' ? 'deleted' : null)
  const [reason, setReason] = useState<'trial' | 'subscription'>('trial')
  const [shopId, setShopId] = useState<string | null>(null)
  const [serverName, setShopName] = useState('')
  const savedName = useStored('shop_name')
  const shopName = serverName || savedName || ''
  const [contact, setContact] = useState<Contact>({ email: '', phone: '' })
  const [loggingOut, setLoggingOut] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  // Once we know the café is gone, stay on that screen: the session is
  // cleared, so later checks would only say "signed out".
  const gone = useRef(params.get('state') === 'deleted')

  // Ask the server what's going on, and keep asking: if the team restores
  // access, the café goes straight back to work.
  const refresh = useCallback(async () => {
    if (gone.current) return
    const info = await fetchAccess()
    if (gone.current) return
    if (!info) {
      // Offline: fall back to what we knew, never to a wrong story.
      setShown((s) => s ?? 'expired')
      return
    }
    const state: AccessState = info.state
    if (state === 'deleted') {
      gone.current = true
      clearShopStorage()
      setShopId(null)
      setShown('deleted')
      return
    }
    if (state === 'expired' || state === 'disabled' || state === 'archived') {
      setShown(state)
      if (info.reason) setReason(info.reason)
      if (info.shop) {
        setShopId(info.shop.id)
        setShopName(info.shop.name)
      }
      return
    }
    // ok → dashboard, pending → /pending, signed_out → login
    if (state === 'signed_out') clearShopStorage()
    const href = state === 'ok' ? '/barista/dashboard' : screenFor(state)
    if (href) router.replace(href)
  }, [router])

  useEffect(() => {
    if (params.get('state') === 'deleted') clearShopStorage()
    // First check right away, then every 30 s.
    const first = setTimeout(() => void refresh(), 0)
    const interval = setInterval(() => void refresh(), 30_000)
    fetch('/api/support-contact', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setContact({ email: j.email ?? '', phone: j.phone ?? '' }))
      .catch(() => {})
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [refresh, params])

  // The in-app chat only exists while the café exists and isn't closed.
  const canChat = !!shopId && (shown === 'expired' || shown === 'disabled')

  const checkUnread = useCallback(async () => {
    if (!canChat || supportOpen) return
    try {
      const res = await fetch(`/api/support?shop_id=${shopId}`, { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) return void refresh()
      if (!res.ok) return
      const json = await res.json()
      setUnread(json.unread ?? 0)
    } catch {}
  }, [canChat, shopId, supportOpen, refresh])

  useEffect(() => {
    if (!canChat) return
    const first = setTimeout(() => void checkUnread(), 0)
    const interval = setInterval(checkUnread, 15000)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [canChat, checkUnread])

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    clearShopStorage()
    router.replace('/barista')
  }

  if (!shown) return <Loading />

  const view = {
    expired: {
      icon: <Clock className="w-9 h-9 text-amber-700" strokeWidth={2} />,
      ring: 'bg-amber-100',
      title: reason === 'trial' ? t('expired.trialTitle') : t('expired.subTitle'),
      body: t('expired.body'),
    },
    disabled: {
      icon: <PauseCircle className="w-9 h-9 text-stone-700" strokeWidth={2} />,
      ring: 'bg-stone-200',
      title: t('account.disabled.title'),
      body: t('account.disabled.body'),
    },
    archived: {
      icon: <Archive className="w-9 h-9 text-stone-700" strokeWidth={2} />,
      ring: 'bg-stone-200',
      title: t('account.archived.title'),
      body: t('account.archived.body'),
    },
    deleted: {
      icon: <XCircle className="w-9 h-9 text-red-700" strokeWidth={2} />,
      ring: 'bg-red-100',
      title: t('account.deleted.title'),
      body: t('account.deleted.body'),
    },
  }[shown]

  const hasContact = !!(contact.email || contact.phone)

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      <header className="px-6 pt-8 pb-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size={32} />
            <span className="text-sm font-semibold">beep</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 px-6 pb-10 flex items-center">
        <div className="max-w-md mx-auto w-full space-y-6 text-center">
          <div className={`w-20 h-20 rounded-full ${view.ring} flex items-center justify-center mx-auto`}>{view.icon}</div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
            {shopName && shown !== 'deleted' && <p className="text-sm text-stone-500">{shopName}</p>}
            <p className="text-stone-500 text-[15px] leading-relaxed">{view.body}</p>
          </div>

          {canChat && (
            <button
              onClick={() => setSupportOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 active:scale-[0.99] transition relative"
            >
              <MessageCircle className="w-4 h-4" />
              {t('support.title')}
              {unread > 0 && (
                <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-5 text-center border-2 border-[#faf7f2] tabular-nums">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )}

          {shown === 'deleted' && (
            <Link
              href="/setup"
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 active:scale-[0.99] transition"
            >
              <Plus className="w-4 h-4" />
              {t('account.newShop')}
            </Link>
          )}

          {hasContact && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 text-start">
              <div className="text-xs uppercase tracking-wider font-semibold text-stone-500">{t('expired.contactTitle')}</div>
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-sm text-stone-800 hover:text-stone-950">
                  <span className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-stone-600" />
                  </span>
                  <span className="break-all">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-3 text-sm text-stone-800 hover:text-stone-950">
                  <span className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-stone-600" />
                  </span>
                  <span dir="ltr">{contact.phone}</span>
                </a>
              )}
            </div>
          )}

          <button
            onClick={logout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-stone-300 font-semibold hover:bg-white disabled:opacity-50 active:scale-[0.99] transition"
          >
            <LogOut className="w-4 h-4 rtl:rotate-180" />
            {shown === 'deleted' ? t('account.backToLogin') : t('expired.logout')}
          </button>

          {(shown === 'expired' || shown === 'disabled') && <p className="text-xs text-stone-400">{t('account.autoRefresh')}</p>}
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <BrandLogo size={14} />
          <span>beep</span>
        </div>
      </footer>

      {supportOpen && shopId && (
        <SupportModal
          shopId={shopId}
          onClose={() => {
            setSupportOpen(false)
            void checkUnread()
          }}
          onAccessLost={() => {
            setSupportOpen(false)
            void refresh()
          }}
        />
      )}
    </main>
  )
}
