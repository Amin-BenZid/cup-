'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, LifeBuoy, MessageSquare, Send } from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type Message = {
  id: string
  message: string
  created_at: string
  shop_id: string
  sender: string
  is_read: boolean
  shops: { name: string; logo_url: string | null } | null
}

type Conversation = {
  shop_id: string
  shop_name: string
  shop_logo: string | null
  messages: Message[]
  unread: number
}

export default function AdminSupportPage() {
  const t = useT()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShop, setActiveShop] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

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

  async function openChat(shopId: string) {
    setActiveShop(shopId)
    // Mark messages as read
    await fetch('/api/admin/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shopId }),
    })
    await load() // reload to update sidebar counters
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !activeShop) return
    setSending(true)
    try {
      await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: activeShop, message: replyText.trim() }),
      })
      setReplyText('')
      await load()
    } finally {
      setSending(false)
    }
  }

  const conversations = messages.reduce((acc, msg) => {
    if (!acc[msg.shop_id]) {
      acc[msg.shop_id] = {
        shop_id: msg.shop_id,
        shop_name: msg.shops?.name ?? 'Unknown',
        shop_logo: msg.shops?.logo_url ?? null,
        messages: [],
        unread: 0,
      }
    }
    acc[msg.shop_id].messages.push(msg)
    if (msg.sender === 'barista' && !msg.is_read) {
      acc[msg.shop_id].unread++
    }
    return acc
  }, {} as Record<string, Conversation>)

  const convList = Object.values(conversations).sort((a, b) => {
    const aLast = new Date(a.messages[a.messages.length - 1].created_at).getTime()
    const bLast = new Date(b.messages[b.messages.length - 1].created_at).getTime()
    return bLast - aLast
  })

  const activeConv = activeShop ? conversations[activeShop] : null

  if (loading) {
    return <main className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></main>
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/admin')} className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition -ms-2 p-2 rounded-lg hover:bg-stone-100">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t('common.back')}
        </button>
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-semibold">{t('admin.support.inbox')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center"><CupLogo size={18} /></div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* INBOX LIST */}
        <div className={`w-full md:w-80 border-e border-stone-200 bg-white overflow-y-auto ${activeShop ? 'hidden md:block' : 'block'}`}>
          {convList.length === 0 ? (
            <div className="text-center py-20 px-6">
              <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-4" />
              <p className="text-sm text-stone-500">{t('admin.support.noMessages')}</p>
            </div>
          ) : (
            convList.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1]
              return (
                <button
                  key={conv.shop_id}
                  onClick={() => openChat(conv.shop_id)}
                  className={`w-full text-start p-4 border-b border-stone-100 hover:bg-stone-50 transition flex gap-3 ${
                    activeShop === conv.shop_id ? 'bg-stone-50' : ''
                  }`}
                >
                  {conv.shop_logo ? (
                    <img src={conv.shop_logo} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-amber-50 font-bold shrink-0">
                      {conv.shop_name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{conv.shop_name}</span>
                      {conv.unread > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">
                      {lastMsg.sender === 'admin' ? 'You: ' : ''}{lastMsg.message}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* CHAT VIEW */}
        <div className={`flex-1 flex flex-col bg-stone-50 ${!activeShop ? 'hidden md:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              <div className="shrink-0 p-4 border-b border-stone-200 bg-white flex items-center gap-3">
                <button onClick={() => setActiveShop(null)} className="md:hidden p-2 -ms-2 text-stone-500">
                  <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                </button>
                {activeConv.shop_logo ? (
                  <img src={activeConv.shop_logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-50 text-xs font-bold">
                    {activeConv.shop_name[0]}
                  </div>
                )}
                <div className="text-sm font-semibold">{activeConv.shop_name}</div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
                {activeConv.messages.map((m) => (
                  <div key={m.id} className={`p-3 rounded-xl border shadow-sm max-w-[80%] ${
                    m.sender === 'admin' 
                      ? 'bg-emerald-50 border-emerald-100 self-end' 
                      : 'bg-white border-stone-200 self-start'
                  }`}>
                    <p className="text-sm text-stone-800">{m.message}</p>
                    <div className="text-[10px] text-stone-400 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={sendReply} className="shrink-0 p-4 border-t border-stone-200 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm transition"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800 disabled:opacity-40 transition"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
              Select a conversation to reply
            </div>
          )}
        </div>
      </div>
    </main>
  )
}