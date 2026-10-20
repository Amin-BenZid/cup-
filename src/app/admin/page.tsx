'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2,
  LogOut,
  Store,
  Search,
  Activity,
  ShoppingBag,
  Star,
  TrendingUp,
  LifeBuoy,
  Megaphone,
  CreditCard,
  Menu,
  X,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { Toast } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'
import SearchBar from '@/components/ui/SearchBar'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'
import { formatTemplate } from '@/lib/i18n/translations'

type ShopStatus = 'pending' | 'active' | 'expired' | 'disabled'

type Shop = {
  id: string
  name: string
  tagline?: string | null
  status: ShopStatus
  created_at: string
  logo_url?: string | null
  is_trial?: boolean
  days_left?: number
  stats: {
    total: number
    last7: number
    last30: number
    today?: number
    last_order_at?: string | null
    rating?: number
    rating_count?: number
  }
}

type GlobalStats = {
  totalOrders: number
  ordersToday: number
  totalShops: number
  activeShops?: number
  expiringSoon?: number
  totalReviews: number
  avgRating: string
}

type StatusFilter = 'all' | 'pending' | 'active' | 'expired' | 'disabled'

export default function AdminHome() {
  const t = useT()
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [unreadSupport, setUnreadSupport] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
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
        setShops(json.shops ?? [])
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
      expired: shops.filter((s) => s.status === 'expired').length,
      disabled: shops.filter((s) => s.status === 'disabled').length,
    }),
    [shops],
  )

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CupLogo size={28} />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                Admin
              </div>
              <div className="text-sm font-semibold leading-tight">
                Dashboard
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition relative"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              {unreadSupport > 0 && !menuOpen && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>

        {/* DROPDOWN */}
        {menuOpen && (
          <div className="absolute top-full right-6 mt-1 w-60 bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden z-50">
            <div className="p-1.5 flex flex-col">
              <Link href="/admin/live" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-zinc-50 transition">
                <Activity className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Live Monitor</span>
              </Link>
              <Link href="/admin/billing" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-zinc-50 transition">
                <CreditCard className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Billing</span>
              </Link>
              <Link href="/admin/support" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-zinc-50 transition">
                <LifeBuoy className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Support</span>
                {unreadSupport > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {unreadSupport}
                  </span>
                )}
              </Link>
              <Link href="/admin/broadcast" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-zinc-50 transition">
                <Megaphone className="w-4 h-4 text-zinc-500" />
                <span className="text-sm">Broadcast</span>
              </Link>
              <div className="h-px bg-zinc-100 my-1.5"></div>
              <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-red-50 transition text-start w-full">
                <LogOut className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">Log out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">

        {/* STATS ROW (CLICKABLE) */}
        {stats && (
          <section>
            <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">
              Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/admin/live" className="block">
                <StatCard
                  label="Today"
                  value={stats.ordersToday}
                  icon={<ShoppingBag className="w-4 h-4" />}
                />
              </Link>
              <Link href="/admin/live" className="block">
                <StatCard
                  label="All orders"
                  value={stats.totalOrders}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
              </Link>
              <Link href="/admin/billing" className="block">
                <StatCard
                  label="Shops"
                  value={stats.totalShops}
                  icon={<Store className="w-4 h-4" />}
                  hint={
                    stats.expiringSoon
                      ? `${stats.expiringSoon} expiring soon`
                      : undefined
                  }
                />
              </Link>
              <Link href="/admin/reviews" className="block">
                <StatCard
                  label="Avg rating"
                  value={Number(stats.avgRating)}
                  suffix="★"
                  icon={<Star className="w-4 h-4" />}
                />
              </Link>
            </div>
          </section>
        )}

        {/* SEARCH & FILTERS */}
        <section className="space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search shops…"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ['all', 'All'],
                ['pending', 'Pending'],
                ['active', 'Active'],
                ['expired', 'Expired'],
                ['disabled', 'Disabled'],
              ] as const
            ).map(([id, label]) => {
              const active = statusFilter === id
              const count = counts[id]
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition border ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {label}
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                      active ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* SHOPS LIST */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">
              Shops
            </h2>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {filtered.length} of {shops.length}
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
            </div>
          ) : shops.length === 0 ? (
            <EmptyState
              title={t('admin.noCafes')}
              description={t('admin.noCafesHint')}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={formatTemplate(t('admin.noMatches'), { query })}
              description=""
              action={
                <button
                  onClick={() => setQuery('')}
                  className="mt-3 text-sm text-zinc-600 hover:text-zinc-900 underline"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100">
              {filtered.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/admin/shops/${shop.id}`}
                  className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {shop.logo_url ? (
                      <img
                        src={shop.logo_url}
                        alt=""
                        className="w-9 h-9 rounded-md object-cover border border-zinc-200 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-100 font-semibold text-xs shrink-0">
                        {shop.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900 truncate">
                          {shop.name}
                        </span>
                        <StatusDot status={shop.status} />
                        {shop.status === 'active' &&
                          typeof shop.days_left === 'number' &&
                          shop.days_left <= 7 && (
                            <span
                              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                shop.days_left <= 3
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {shop.days_left === 0
                                ? 'ends today'
                                : `${shop.days_left}d left`}
                            </span>
                          )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {shop.tagline || 'No tagline'}
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 shrink-0 text-xs text-zinc-500 tabular-nums">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">30d</div>
                      <div className="text-sm font-medium text-zinc-900">{shop.stats.last30}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Total</div>
                      <div className="text-sm font-medium text-zinc-900">{shop.stats.total}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition rtl:rotate-180" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  hint,
}: {
  label: string
  value: number
  suffix?: string
  icon: React.ReactNode
  hint?: string
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-400 hover:bg-zinc-50 transition cursor-pointer h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
          {label}
        </span>
        <span className="text-zinc-400">{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-zinc-900 tabular-nums leading-none">
        {value}
        {suffix && <span className="text-sm text-zinc-400 ml-1">{suffix}</span>}
      </div>
      {hint && (
        <div className="text-[10px] text-amber-600 font-medium mt-1.5">
          {hint}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  if (status === 'disabled') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Disabled
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-orange-600">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        Expired
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  )
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-16 bg-white border border-dashed border-zinc-300 rounded-lg">
      <h3 className="text-sm font-medium text-zinc-900">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}