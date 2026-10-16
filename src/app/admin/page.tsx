'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Coffee,
  Loader2,
  LogOut,
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'
import SearchBar from '@/components/ui/SearchBar'
import CupLogo from '@/components/CupLogo'

type Shop = {
  id: string
  name: string
  tagline?: string | null
  status: string
  created_at: string
  logo_url?: string | null
  stats: { total: number; last7: number; last30: number }
}

type StatusFilter = 'all' | 'pending' | 'active' | 'disabled'

export default function AdminHome() {
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const { toasts, push, dismiss } = useToasts()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/shops', { cache: 'no-store' })
        if (res.status === 401) {
          router.replace('/admin/login')
          return
        }
        const json = await res.json()
        if (!res.ok) {
          push('error', json.error ?? 'Failed to load')
          return
        }
        setShops(json.shops)
      } catch (e) {
        push('error', e instanceof Error ? e.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, push])

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.replace('/admin/login')
  }

  // ---------- filtering ----------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return shops.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!q) return true
      const hay = [s.name, s.tagline ?? '', s.id].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [shops, query, statusFilter])

  const counts = useMemo(
    () => ({
      all: shops.length,
      pending: shops.filter((s) => s.status === 'pending').length,
      active: shops.filter((s) => s.status === 'active').length,
      disabled: shops.filter((s) => s.status === 'disabled').length,
    }),
    [shops]
  )

  function dateLabel(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CupLogo size={36} />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-medium">
                Cup · Admin
              </div>
              <div className="text-sm font-semibold">Cafés</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition px-3 py-2 rounded-lg hover:bg-stone-100"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">All cafés</h1>
          <span className="text-xs text-stone-500 tabular-nums">
            {filtered.length} of {shops.length}
          </span>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search by name, tagline or ID…"
              hotkey="k"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-200/60 border border-stone-200 shrink-0 overflow-x-auto">
            {(
              [
                ['all', 'All'],
                ['pending', 'Pending'],
                ['active', 'Active'],
                ['disabled', 'Disabled'],
              ] as const
            ).map(([id, label]) => {
              const active = statusFilter === id
              const count = counts[id]
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                    active
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {label}
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                      active
                        ? 'bg-stone-100 text-stone-500'
                        : 'bg-stone-300/60 text-stone-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          </div>
        ) : shops.length === 0 ? (
          <EmptyNoCafes />
        ) : filtered.length === 0 ? (
          <EmptyNoResults query={query} onClear={() => setQuery('')} />
        ) : (
          <div className="space-y-3">
            {filtered.map((shop) => (
              <Link
                key={shop.id}
                href={`/admin/shops/${shop.id}`}
                className="block rounded-2xl border border-stone-200 bg-white p-4 hover:border-stone-400 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {shop.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shop.logo_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-stone-900 flex items-center justify-center text-amber-50 font-bold shrink-0">
                        {(shop.name || 'C')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">
                          <Highlight text={shop.name} query={query} />
                        </span>
                        {shop.status === 'disabled' ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <XCircle className="w-3 h-3" />
                            Disabled
                          </span>
                        ) : shop.status === 'pending' ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5 truncate">
                        {shop.tagline ? (
                          <Highlight text={shop.tagline} query={query} />
                        ) : (
                          'No tagline'
                        )}{' '}
                        · {dateLabel(shop.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <Stat label="7d" value={shop.stats.last7} />
                    <Stat label="30d" value={shop.stats.last30} />
                    <Stat label="Total" value={shop.stats.total} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums text-stone-900">
        {value}
      </div>
    </div>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200/60 rounded px-0.5 text-stone-900">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function EmptyNoCafes() {
  return (
    <div className="text-center py-20 border border-dashed border-stone-300 rounded-2xl">
      <Store className="w-8 h-8 text-stone-300 mx-auto mb-3" />
      <p className="text-sm text-stone-500">No cafés yet</p>
      <p className="text-xs text-stone-400 mt-1">
        Share the setup link with a café to get started
      </p>
    </div>
  )
}

function EmptyNoResults({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div className="text-center py-20 border border-dashed border-stone-300 rounded-2xl">
      <Search className="w-8 h-8 text-stone-300 mx-auto mb-3" />
      <p className="text-sm text-stone-500">
        No cafés match &ldquo;{query}&rdquo;
      </p>
      <button
        onClick={onClear}
        className="mt-3 text-xs text-stone-500 hover:text-stone-900 underline underline-offset-2"
      >
        Clear search
      </button>
    </div>
  )
}