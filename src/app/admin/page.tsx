'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  LogOut,
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Activity,
  ShoppingBag,
  Star,
  TrendingUp,
  LifeBuoy,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'
import SearchBar from '@/components/ui/SearchBar'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'
import { formatTemplate } from '@/lib/i18n/translations'

type Shop = {
  id: string
  name: string
  tagline?: string | null
  status: string
  created_at: string
  logo_url?: string | null
  stats: { total: number; last7: number; last30: number }
}

type GlobalStats = {
  totalOrders: number
  ordersToday: number
  totalShops: number
  totalReviews: number
  avgRating: string
}

type StatusFilter = 'all' | 'pending' | 'active' | 'disabled'

export default function AdminHome() {
  const t = useT()
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [unreadSupport, setUnreadSupport] = useState(0)
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
        setStats(json.globalStats)
      } catch (e) {
        push('error', e instanceof Error ? e.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, push])

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/admin/support')
        const json = await res.json()
        setUnreadSupport(json.unread ?? 0)
      } catch {}
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.replace('/admin/login')
  }

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

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center shadow-sm">
              <CupLogo size={18} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold leading-none mb-1">
                {t('admin.title')}
              </div>
              <div className="text-sm font-semibold leading-none">
                {t('admin.cafes')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/live"
              className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition"
            >
              <Activity className="w-3.5 h-3.5" />
              Live
            </Link>
            <Link
              href="/admin/support"
              className="relative p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition"
              title={t('admin.support.inbox')}
            >
              <LifeBuoy className="w-5 h-5" />
              {unreadSupport > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-stone-50">
                  {unreadSupport}
                </span>
              )}
            </Link>
            <LanguageSwitcher compact />
            <button
              onClick={logout}
              className="p-2 -me-2 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-200/50 active:scale-95 transition"
              aria-label={t('admin.logout')}
            >
              <LogOut className="w-5 h-5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-5 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-stone-400 mb-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('admin.stats.today')}</span>
              </div>
              <div className="text-xl font-bold text-stone-900 tabular-nums">{stats.ordersToday}</div>
            </div>
            
            <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-stone-400 mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('admin.stats.total')}</span>
              </div>
              <div className="text-xl font-bold text-stone-900 tabular-nums">{stats.totalOrders}</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-stone-400 mb-1">
                <Store className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('admin.stats.shops')}</span>
              </div>
              <div className="text-xl font-bold text-stone-900 tabular-nums">{stats.totalShops}</div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-stone-400 mb-1">
                <Star className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{t('admin.stats.rating')}</span>
              </div>
              <div className="text-xl font-bold text-stone-900 tabular-nums">
                {stats.avgRating} <span className="text-sm text-stone-400">★</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('admin.search')}
          />

          <div className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ['all', t('admin.all')],
                ['pending', t('admin.pending')],
                ['active', t('admin.active')],
                ['disabled', t('admin.disabled')],
              ] as const
            ).map(([id, label]) => {
              const active = statusFilter === id
              const count = counts[id]
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-sm font-medium transition active:scale-95 ${
                    active
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {label}
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : shops.length === 0 ? (
          <EmptyState
            icon={<Store className="w-10 h-10 text-stone-300" />}
            title={t('admin.noCafes')}
            description={t('admin.noCafesHint')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="w-10 h-10 text-stone-300" />}
            title={formatTemplate(t('admin.noMatches'), { query })}
            description=""
            action={
              <button
                onClick={() => setQuery('')}
                className="mt-4 px-5 py-2.5 rounded-xl bg-stone-200 text-stone-800 text-sm font-medium hover:bg-stone-300 transition"
              >
                {t('admin.clearSearch')}
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((shop) => (
              <Link
                key={shop.id}
                href={`/admin/shops/${shop.id}`}
                className="group flex flex-col bg-white rounded-2xl border border-stone-200 p-3 hover:border-stone-300 hover:shadow-sm transition active:scale-[0.97]"
              >
                <div className="flex items-start justify-between mb-3">
                  {shop.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.logo_url}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover border border-stone-100 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-amber-50 font-bold text-sm shadow-sm">
                      {(shop.name || 'C')[0].toUpperCase()}
                    </div>
                  )}
                  <StatusDot status={shop.status} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate leading-tight">
                    <Highlight text={shop.name} query={query} />
                  </div>
                  <div className="text-[11px] text-stone-500 truncate mt-0.5">
                    {shop.tagline || '-'}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                  <div>
                    <span className="font-semibold text-stone-800">
                      {shop.stats.last30}
                    </span>{' '}
                    30d
                  </div>
                  <div className="text-stone-300">•</div>
                  <div>
                    <span className="font-semibold text-stone-800">
                      {shop.stats.total}
                    </span>{' '}
                    {t('admin.all').toLowerCase()}
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

function StatusDot({ status }: { status: string }) {
  if (status === 'disabled') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-600">
        <XCircle className="w-3.5 h-3.5" />
      </div>
    )
  }
  if (status === 'pending') {
    return (
      <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
        <Clock className="w-3.5 h-3.5" />
      </div>
    )
  }
  return (
    <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
      <CheckCircle2 className="w-3.5 h-3.5" />
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
      <mark className="bg-amber-200/60 rounded-sm px-0.5 text-stone-900">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-24 px-6 col-span-2">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      {description && (
        <p className="text-sm text-stone-500 mt-1 max-w-[240px] mx-auto">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}