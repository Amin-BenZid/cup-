'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Mail, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { typeShopCode } from '@/lib/shop-code'

type Contact = { email: string; phone: string }

/**
 * "Forgot PIN?" sheet for the staff login. Nothing is reset here: it sends a
 * request to the Beep team, who call the café's phone on file to verify and
 * then give a new PIN. The reference lets the café prove the request is theirs.
 */
export default function ForgotPin({ initialCode, onClose }: { initialCode: string; onClose: () => void }) {
  const t = useT()
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ref, setRef] = useState<string | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    fetch('/api/support-contact', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setContact({ email: String(c.email ?? ''), phone: String(c.phone ?? '') }))
      .catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (code.replace(/-/g, '').length < 3) return setError(t('setup.error.codeLength'))
    setBusy(true)
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 429) return setError(t('forgot.error.tooMany'))
      if (!res.ok || !json.ref) return setError(t('forgot.error.generic'))
      setRef(String(json.ref))
    } catch {
      setError(t('forgot.error.generic'))
    } finally {
      setBusy(false)
    }
  }

  const message = ref ? t('forgot.message', { code: code.replace(/^-+|-+$/g, ''), ref }) : ''
  const digits = contact?.phone.replace(/[^\d]/g, '') ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
      <button aria-label={t('forgot.close')} className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#faf7f2] rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-end px-4 pt-4">
          <button onClick={onClose} aria-label={t('forgot.close')} className="p-2 -m-1 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-200/60 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-7 -mt-2">
          {!ref ? (
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-stone-900 text-amber-50 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 id="forgot-title" className="text-2xl font-semibold tracking-tight">{t('forgot.title')}</h2>
                <p className="text-stone-500 text-[15px] leading-relaxed">{t('forgot.body')}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-900">{t('forgot.codeLabel')}</label>
                <input
                  type="text"
                  value={code}
                  autoFocus={!initialCode}
                  onChange={(e) => setCode(typeShopCode(e.target.value))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('setup.codePlaceholder')}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition font-mono"
                />
              </div>

              {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{error}</div>}

              <button
                type="submit"
                disabled={busy || code.replace(/-/g, '').length < 3}
                className="w-full py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 disabled:opacity-40 active:scale-[0.99] transition flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('forgot.submit')}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 id="forgot-title" className="text-2xl font-semibold tracking-tight">{t('forgot.sentTitle')}</h2>
              </div>

              <div className="rounded-2xl bg-white border border-stone-200 px-4 py-4 text-center">
                <div className="text-xs text-stone-500">{t('forgot.refLabel')}</div>
                <div dir="ltr" className="font-mono text-3xl font-semibold tracking-[0.25em] mt-1 select-all">{ref}</div>
              </div>

              <ol className="space-y-2.5">
                {(['forgot.step1', 'forgot.step2', 'forgot.step3'] as const).map((k, i) => (
                  <li key={k} className="flex gap-3 text-[15px] text-stone-700 leading-snug">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-stone-900 text-amber-50 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                    <span className="pt-0.5">{t(k)}</span>
                  </li>
                ))}
              </ol>

              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">{t('forgot.never')}</p>

              {contact && (digits || contact.email) && (
                <div className="space-y-2">
                  <div className="text-xs text-stone-500">{t('forgot.faster')}</div>
                  <div className="flex gap-2">
                    {digits && (
                      <a
                        href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
                      >
                        <MessageCircle className="w-4 h-4" /> {t('forgot.whatsapp')}
                      </a>
                    )}
                    {digits && (
                      <a href={`tel:+${digits}`} className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border border-stone-200 text-sm font-medium hover:bg-stone-50">
                        <Phone className="w-4 h-4" /> {t('forgot.call')}
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}?subject=${encodeURIComponent(t('forgot.title'))}&body=${encodeURIComponent(message)}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border border-stone-200 text-sm font-medium hover:bg-stone-50"
                      >
                        <Mail className="w-4 h-4" /> {t('forgot.email')}
                      </a>
                    )}
                  </div>
                </div>
              )}

              <button onClick={onClose} className="w-full py-3 rounded-2xl text-stone-600 text-sm font-medium hover:bg-stone-200/50 transition">
                {t('forgot.close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
