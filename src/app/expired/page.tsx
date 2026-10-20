'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, Mail, Phone, MessageCircle } from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import SupportModal from '@/components/SupportModal'
import { useT } from '@/lib/i18n/context'

type Contact = { email: string; phone: string }

export default function ExpiredPage() {
  const t = useT()
  const router = useRouter()
  const [shopId, setShopId] = useState<string | null>(null)
  const [shopName, setShopName] = useState('')
  const [reason, setReason] = useState<'trial' | 'subscription'>('trial')
  const [contact, setContact] = useState<Contact>({ email: '', phone: '' })
  const [loggingOut, setLoggingOut] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const id = localStorage.getItem('shop_id')
    if (!id) {
      router.replace('/barista')
      return
    }
    setShopId(id)
    setShopName(localStorage.getItem('shop_name') ?? '')

    const stored = localStorage.getItem('shop_expired_reason')
    if (stored === 'subscription') setReason('subscription')

    fetch('/api/support-contact', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setContact({ email: j.email ?? '', phone: j.phone ?? '' })
      })
      .catch(() => {})
  }, [router])

  const checkUnread = useCallback(async () => {
    if (!shopId || supportOpen) return
    try {
      const res = await fetch(`/api/support?shop_id=${shopId}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const json = await res.json()
      setUnread(json.unread ?? 0)
    } catch {}
  }, [shopId, supportOpen])

  useEffect(() => {
    if (!shopId) return
    checkUnread()
    const interval = setInterval(checkUnread, 15000)
    return () => clearInterval(interval)
  }, [shopId, checkUnread])

  async function logout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    localStorage.removeItem('shop_id')
    localStorage.removeItem('shop_name')
    localStorage.removeItem('shop_expired_reason')
    router.replace('/barista')
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      <header className="px-6 pt-8 pb-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CupLogo size={32} />
            <span className="text-sm font-semibold">Cup</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 px-6 pb-10 flex items-center">
        <div className="max-w-md mx-auto w-full space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <Clock className="w-9 h-9 text-amber-700" strokeWidth={2} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {reason === 'trial'
                ? t('expired.trialTitle')
                : t('expired.subTitle')}
            </h1>
            {shopName && <p className="text-sm text-stone-500">{shopName}</p>}
            <p className="text-stone-500 text-[15px] leading-relaxed">
              {t('expired.body')}
            </p>
          </div>

          {shopId && (
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

          <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 text-start">
            <div className="text-xs uppercase tracking-wider font-semibold text-stone-500">
              {t('expired.contactTitle')}
            </div>

            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-3 text-sm text-stone-800 hover:text-stone-950"
              >
                <span className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-stone-600" />
                </span>
                <span className="break-all">{contact.email}</span>
              </a>
            )}

            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-3 text-sm text-stone-800 hover:text-stone-950"
              >
                <span className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-stone-600" />
                </span>
                <span dir="ltr">{contact.phone}</span>
              </a>
            )}

            {!contact.email && !contact.phone && (
              <p className="text-sm text-stone-500">{t('expired.body')}</p>
            )}
          </div>

          <button
            onClick={logout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-stone-300 font-semibold hover:bg-white disabled:opacity-50 active:scale-[0.99] transition"
          >
            <LogOut className="w-4 h-4 rtl:rotate-180" />
            {t('expired.logout')}
          </button>
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <CupLogo size={14} />
          <span>Cup</span>
        </div>
      </footer>

      {supportOpen && shopId && (
        <SupportModal
          shopId={shopId}
          onClose={() => {
            setSupportOpen(false);
            void checkUnread();
          }}
        />
      )}
    </main>
  )
}