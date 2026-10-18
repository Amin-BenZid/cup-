'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Megaphone } from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

export default function BroadcastPage() {
  const t = useT()
  const router = useRouter()
  
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/broadcast', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        // Handle the case where the API returns a stringified JSON
        let data = j.broadcast
        if (typeof data === 'string') {
          try { data = JSON.parse(data) } catch {}
        }
        setActive(data?.active ?? false)
        setMessage(data?.message ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    
    try {
      const res = await fetch('/api/broadcast', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, message }),
      })
      
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        const err = await res.json()
        alert('Failed to save: ' + (err.error || 'Unknown error'))
      }
    } catch (e) {
      alert('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition -ms-2 p-2 rounded-lg hover:bg-stone-100"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('common.back')}
        </button>
        <span className="text-sm font-semibold">{t('admin.broadcast.title')}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center">
            <CupLogo size={18} />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-5 shadow-sm">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-stone-700">
              <Megaphone className="w-5 h-5" />
              <p className="text-sm font-medium">{t('admin.broadcast.active')}</p>
            </div>
            
            {/* FIXED TOGGLE SWITCH */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('admin.broadcast.placeholder')}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition resize-none"
          />
          
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 disabled:opacity-40 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('admin.broadcast.save')}
          </button>
          
          {saved && (
            <p className="text-xs text-emerald-600 text-center font-medium animate-pulse">
              {t('admin.broadcast.saved')}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}