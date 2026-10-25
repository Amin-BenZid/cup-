'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, Search, Send } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  cx,
  Empty,
  ErrorBanner,
  fmtDate,
  inputCls,
  PageHeader,
  ShopAvatar,
  Skeleton,
  timeAgo,
  useAdminData,
} from '@/components/admin/ui'

type Msg = {
  id: string
  message: string
  created_at: string
  shop_id: string
  sender: 'barista' | 'admin'
  is_read: boolean
  shops: { name: string; logo_url: string | null } | null
}

type Thread = { shop_id: string; name: string; logo_url: string | null; messages: Msg[]; unread: number; last: Msg }

export default function SupportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Inbox />
    </Suspense>
  )
}

function Inbox() {
  const router = useRouter()
  const params = useSearchParams()
  const selected = params.get('shop') ?? ''
  const { refreshBadges, toast } = useAdmin()
  const { data, setData, error, loading, reload } = useAdminData<{ messages: Msg[] }>('/api/admin/support', {
    pollMs: selected ? 8000 : 20000,
  })
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Shop name for a thread with no messages yet (opened from a café page).
  const { data: shopInfo } = useAdminData<{ shop: { name: string; logo_url: string | null } }>(
    selected && !data?.messages.some((m) => m.shop_id === selected) ? `/api/admin/shops/${selected}` : null,
  )

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>()
    for (const m of data?.messages ?? []) {
      let t = map.get(m.shop_id)
      if (!t) {
        t = { shop_id: m.shop_id, name: m.shops?.name ?? 'Unknown café', logo_url: m.shops?.logo_url ?? null, messages: [], unread: 0, last: m }
        map.set(m.shop_id, t)
      }
      t.messages.push(m)
      if (m.sender === 'barista' && !m.is_read) t.unread++
    }
    for (const t of map.values()) t.messages.reverse() // oldest → newest
    return [...map.values()].sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.last.created_at.localeCompare(a.last.created_at))
  }, [data])

  const current = threads.find((t) => t.shop_id === selected)
  const currentName = current?.name ?? shopInfo?.shop?.name ?? ''

  // Mark the open thread as read.
  const unreadInCurrent = current?.unread ?? 0
  useEffect(() => {
    if (!selected || unreadInCurrent === 0) return
    void adminFetch('/api/admin/support', { method: 'PATCH', body: { shop_id: selected } }).then((r) => {
      if (!r.ok) return
      setData((prev) =>
        prev ? { messages: prev.messages.map((m) => (m.shop_id === selected && m.sender === 'barista' ? { ...m, is_read: true } : m)) } : prev,
      )
      refreshBadges()
    })
  }, [selected, unreadInCurrent, setData, refreshBadges])

  const messageCount = current?.messages.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [selected, messageCount])

  async function send() {
    const text = draft.trim()
    if (!text || !selected) return
    setSending(true)
    const r = await adminFetch('/api/admin/support', { method: 'POST', body: { shop_id: selected, message: text } })
    setSending(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed to send')
    setDraft('')
    void reload()
  }

  const filtered = threads.filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()))
  const open = (id: string) => router.push(id ? `/admin/support?shop=${id}` : '/admin/support')

  return (
    <div>
      <PageHeader title="Support" subtitle="Messages from cafés. Replies show up in their dashboard." />
      <ErrorBanner message={error} onRetry={reload} />

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden grid md:grid-cols-[300px_1fr] h-[calc(100dvh-240px)] min-h-[420px]">
        {/* Thread list */}
        <div className={cx('border-e border-zinc-100 flex flex-col min-h-0', selected && 'hidden md:flex')}>
          <div className="p-2 border-b border-zinc-100">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cafés" className={cx(inputCls, 'ps-9 h-8')} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && !data ? (
              <div className="p-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : filtered.length === 0 ? (
              <Empty title="No conversations" />
            ) : (
              filtered.map((t) => (
                <button
                  key={t.shop_id}
                  onClick={() => open(t.shop_id)}
                  className={cx('w-full flex items-center gap-2.5 px-3 py-2.5 text-start border-b border-zinc-50', t.shop_id === selected ? 'bg-zinc-100' : 'hover:bg-zinc-50')}
                >
                  <ShopAvatar name={t.name} logo={t.logo_url} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx('text-sm truncate', t.unread ? 'font-semibold' : 'font-medium')}>{t.name}</span>
                      <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(t.last.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cx('text-xs truncate flex-1', t.unread ? 'text-zinc-800' : 'text-zinc-500')}>
                        {t.last.sender === 'admin' && 'You: '}
                        {t.last.message}
                      </span>
                      {t.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-[18px] text-center">{t.unread}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={cx('flex flex-col min-h-0', !selected && 'hidden md:flex')}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <Empty title="Pick a conversation" hint="Unread threads are at the top." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 h-12 border-b border-zinc-100 shrink-0">
                <button onClick={() => open('')} className="md:hidden p-1.5 -ms-1 rounded-md hover:bg-zinc-100" aria-label="Back">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold truncate flex-1">{currentName || '…'}</span>
                <Link href={`/admin/shops/${selected}`} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
                  Café <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-zinc-50/60">
                {(current?.messages ?? []).length === 0 && <Empty title="No messages yet" hint="Write the first one below." />}
                {(current?.messages ?? []).map((m) => (
                  <div key={m.id} className={cx('flex', m.sender === 'admin' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cx(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                        m.sender === 'admin' ? 'bg-zinc-900 text-white rounded-br-md' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-md',
                      )}
                    >
                      {m.message}
                      <div className={cx('text-[10px] mt-1', m.sender === 'admin' ? 'text-zinc-400' : 'text-zinc-400')}>
                        {fmtDate(m.created_at, true)}
                        {m.sender === 'admin' && (m.is_read ? ' · seen' : ' · sent')}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void send()
                }}
                className="flex items-end gap-2 p-2 border-t border-zinc-100 shrink-0"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Write a reply…"
                  className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="h-9 w-9 shrink-0 rounded-lg bg-zinc-900 text-white flex items-center justify-center disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
