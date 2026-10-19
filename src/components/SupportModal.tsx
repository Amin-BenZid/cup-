'use client'

import { useEffect, useState } from 'react'
import { X, Send, LifeBuoy, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useT } from '@/lib/i18n/context'

type Message = { id: string; message: string; created_at: string; sender: string }

export default function SupportModal({ shopId, onClose }: { shopId: string; onClose: () => void }) {
  const t = useT()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch(`/api/support?shop_id=${shopId}`)
      if (res.ok) {
        const json = await res.json()
        setMessages(json.messages ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    
    // Mark admin messages as read
    fetch('/api/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shopId }),
    }).catch(() => {})

    // Listen for new messages
    const channel = supabase
      .channel('support-chat')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `shop_id=eq.${shopId}` }, 
        () => load()
      )
      .subscribe()

    // LOCK BACKGROUND SCROLL
    document.body.style.overflow = 'hidden'

    return () => { 
      supabase.removeChannel(channel) 
      // UNLOCK BACKGROUND SCROLL
      document.body.style.overflow = ''
    }
  }, [shopId])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return
    
    setSending(true)
    const msgText = text.trim()
    setText('') // Clear input immediately for better UX

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, message: msgText }),
      })
      
      if (res.ok) {
        const newMsg = await res.json()
        // Add to UI immediately
        setMessages((prev) => [newMsg.message, ...prev])
      } else {
        setText(msgText)
        alert('Failed to send message. Please try again.')
      }
    } catch (err) {
      setText(msgText)
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col h-[80vh] sm:h-auto sm:max-h-[600px]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-stone-400" />
            <h2 className="text-lg font-semibold">{t('support.title')}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-stone-50/50 flex flex-col-reverse overscroll-contain">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-stone-400 mt-10" />
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-stone-500 py-6">{t('support.noHistory')}</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`p-3 rounded-xl border shadow-sm max-w-[85%] ${
                m.sender === 'admin' 
                  ? 'bg-emerald-50 border-emerald-100 self-start' 
                  : 'bg-white border-stone-200 self-end'
              }`}>
                <p className="text-sm text-stone-800">{m.message}</p>
                <div className="text-[10px] text-stone-400 mt-1">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={send} className="p-4 border-t border-stone-100 bg-white rounded-b-3xl shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('support.placeholder')}
              className="flex-1 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800 disabled:opacity-40 transition"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}