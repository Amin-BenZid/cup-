'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, LifeBuoy, CheckCircle2, MessageSquare } from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type Message = {
  id: string
  message: string
  status: string
  created_at: string
  shop_id: string
  shops: { name: string; logo_url: string | null } | null
}

export default function SupportInbox() {
  const t = useT()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch('/api/admin/support', { cache: 'no-store' })
      if (res.status === 401) return router.replace('/admin/login')
      const json = await res.json()
      if (res.ok) setMessages(json.messages)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    await fetch('/api/admin/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition -ms-2 p-2 rounded-lg hover:bg-stone-200/50">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-semibold">{t('admin.support.inbox')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center">
              <CupLogo size={18} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400 mt-10" />
        ) : messages.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-stone-300 rounded-2xl bg-white">
            <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-4" />
            <p className="text-sm text-stone-500">{t('admin.support.noMessages')}</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`p-4 bg-white rounded-2xl border ${m.status === 'unread' ? 'border-emerald-300 shadow-sm' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {m.shops?.logo_url ? (
                    <img src={m.shops.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-50 text-xs font-bold">
                      {(m.shops?.name || 'C')[0]}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold">{m.shops?.name}</div>
                    <div className="text-[10px] text-stone-400">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${m.status === 'unread' ? 'bg-emerald-100 text-emerald-700' : m.status === 'resolved' ? 'bg-stone-100 text-stone-500' : 'bg-blue-100 text-blue-700'}`}>
                  {m.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-700">{m.message}</p>
              {m.status !== 'resolved' && (
                <div className="mt-3 flex gap-2">
                  {m.status === 'unread' && (
                    <button onClick={() => updateStatus(m.id, 'read')} className="px-3 py-1.5 text-xs font-medium bg-stone-100 hover:bg-stone-200 rounded-lg transition">
                      {t('admin.support.markRead')}
                    </button>
                  )}
                  <button onClick={() => updateStatus(m.id, 'resolved')} className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {t('admin.support.markResolved')}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  )
}