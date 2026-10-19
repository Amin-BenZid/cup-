'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  LifeBuoy,
  MessageSquare,
  Send,
} from 'lucide-react'
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
  lastMessage: Message
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
      if (res.ok) setMessages(json.messages ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function openChat(shopId: string) {
    setActiveShop(shopId)
    await fetch('/api/admin/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shopId }),
    })
    await load()
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim() || !activeShop || sending) return

    setSending(true)
    const text = replyText.trim()
    setReplyText('')

    try {
      await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: activeShop, message: text }),
      })
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
        lastMessage: msg,
      }
    }
    acc[msg.shop_id].messages.push(msg)
    if (msg.sender === 'barista' && !msg.is_read) {
      acc[msg.shop_id].unread++
    }
    return acc
  }, {} as Record<string, Conversation>)

  const convList = Object.values(conversations).sort((a, b) => {
    const aLast = new Date(a.lastMessage.created_at).getTime()
    const bLast = new Date(b.lastMessage.created_at).getTime()
    return bLast - aLast
  })

  const activeConv = activeShop ? conversations[activeShop] : null

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition -ms-2 p-2 rounded-md hover:bg-zinc-100"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold">Support</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <CupLogo size={20} />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* INBOX LIST */}
        <div
          className={`w-full md:w-80 border-e border-zinc-200 bg-white overflow-y-auto ${
            activeShop ? 'hidden md:block' : 'block'
          }`}
        >
          {convList.length === 0 ? (
            <div className="text-center py-20 px-6">
              <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                {t('admin.support.noMessages')}
              </p>
            </div>
          ) : (
            convList.map((conv) => (
              <button
                key={conv.shop_id}
                onClick={() => openChat(conv.shop_id)}
                className={`w-full text-start px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition flex gap-3 ${
                  activeShop === conv.shop_id ? 'bg-zinc-50' : ''
                }`}
              >
                {conv.shop_logo ? (
                  <img
                    src={conv.shop_logo}
                    alt=""
                    className="w-9 h-9 rounded-md object-cover border border-zinc-200 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-100 font-semibold text-xs shrink-0">
                    {conv.shop_name[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {conv.shop_name}
                    </span>
                    {conv.unread > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {conv.lastMessage.sender === 'admin' ? 'You: ' : ''}
                    {conv.lastMessage.message}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* CHAT VIEW */}
        <div
          className={`flex-1 flex flex-col bg-white ${
            !activeShop ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="shrink-0 px-5 py-3 border-b border-zinc-200 flex items-center gap-3">
                <button
                  onClick={() => setActiveShop(null)}
                  className="md:hidden p-1 -ms-2 text-zinc-500"
                >
                  <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                </button>
                {activeConv.shop_logo ? (
                  <img
                    src={activeConv.shop_logo}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover border border-zinc-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-100 text-xs font-semibold">
                    {activeConv.shop_name[0].toUpperCase()}
                  </div>
                )}
                <div className="text-sm font-medium text-zinc-900">
                  {activeConv.shop_name}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 flex flex-col-reverse bg-zinc-50/50">
                {activeConv.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      m.sender === 'admin'
                        ? 'bg-zinc-900 text-white self-end'
                        : 'bg-white border border-zinc-200 text-zinc-900 self-start'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{m.message}</p>
                    <div
                      className={`text-[10px] mt-1 tabular-nums ${
                        m.sender === 'admin' ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    >
                      {new Date(m.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form
                onSubmit={sendReply}
                className="shrink-0 p-3 border-t border-zinc-200 bg-white"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition"
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition flex items-center gap-2"
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-400 bg-zinc-50/50">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </main>
  )
}