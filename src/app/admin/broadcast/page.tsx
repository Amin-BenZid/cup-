'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Megaphone,
  History,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type BroadcastHistory = {
  id: string
  message: string
  active: boolean
  created_at: string
}

export default function BroadcastPage() {
  const t = useT()
  const router = useRouter()
  
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState<BroadcastHistory[]>([])
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/broadcast', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        let data = j.broadcast
        if (typeof data === 'string') {
          try { data = JSON.parse(data) } catch {}
        }
        setActive(data?.active ?? false)
        setMessage(data?.message ?? '')
        setHistory(j.history ?? [])
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
        
        // Refresh history
        const refreshRes = await fetch('/api/broadcast', { cache: 'no-store' })
        const refreshJson = await refreshRes.json()
        setHistory(refreshJson.history ?? [])
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
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="border-b border-zinc-200 bg-zinc-50 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition -ms-2 p-2 rounded-md hover:bg-zinc-100"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold">Broadcast</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <CupLogo size={20} />
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-8">
        
        {/* COMPOSER */}
        <section className="bg-white border border-zinc-200 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Compose message</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                {active ? 'Live' : 'Inactive'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message to broadcast to all baristas..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-zinc-200 bg-zinc-50 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 outline-none text-sm transition resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                {message.length} characters
              </span>
              <button
                onClick={save}
                disabled={saving || !message.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-40 transition"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Update Broadcast'}
              </button>
            </div>
            {saved && (
              <p className="text-xs text-emerald-600">
                Broadcast updated successfully.
              </p>
            )}
          </div>
        </section>

        {/* HISTORY */}
        <section className="bg-white border border-zinc-200 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold">History</h2>
            </div>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {history.length} entries
            </span>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No broadcasts sent yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      {h.active ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm text-zinc-800 break-words">
                        {h.message}
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1 ms-6 tabular-nums">
                    {new Date(h.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}