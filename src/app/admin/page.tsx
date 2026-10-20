'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Clock,
  CreditCard,
  LifeBuoy,
  LogOut,
  Megaphone,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
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
    last30: number
    last7?: number
    last_order_at?: string | null
    rating?: number
    rating_count?: number
  }
}

type GlobalStats = {
  totalOrders: number
  ordersToday: number
  totalShops: number
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
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [unreadSupport, setUnreadSupport] = useState(0)

  const { toasts, push, dismiss } = useToasts()

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/shops', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/admin/login')
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load')
        return
      }
      setShops(json.shops ?? [])
      setStats(json.globalStats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

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

  const expiring = useMemo(
    () =>
      shops.filter(
        (s) =>
          s.status === 'active' &&
          typeof s.days_left === 'number' &&
          s.days_left <= 7,
      ),
    [shops],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return shops.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!q) return true
      return [s.name, s.tagline ?? '', s.id].join(' ').toLowerCase().includes(q)
    })
  }, [shops, query, statusFilter])

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CupLogo size={28} />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                Admin
              </div>
              <div className="text-sm font-semibold leading-tight">{t('admin.title')}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/support"
              className="relative p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition"
              title={t('support.button')}
            >
              <LifeBuoy className="w-5 h-5" />
              {unreadSupport > 0 && (
                <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-4 text-center">
                  {unreadSupport > 9 ? '9+' : unreadSupport}
                </span>
              )}
            </Link>
            <LanguageSwitcher compact />
            <button
              onClick={logout}
              className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
              title={t('admin.logout')}
            >
              <LogOut className="w-5 h-5 rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* NAV — always visible, no hidden menu */}
        <nav className="max-w-5xl mx-auto px-6 pb-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { href: '/admin/live', icon: Activity, label: t('live.title') },
            { href: '/admin/billing', icon: CreditCard, label: t('admin.billing') },
            { href: '/admin/support', icon: LifeBuoy, label: t('support.title') },
            { href: '/admin/reviews', icon: Star, label: t('admin.reviews') },
            { href: '/admin/broadcast', icon: Megaphone, label: t('admin.broadcast.title') },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 transition"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ATTENTION STRIP */}
        {!loading && (counts.pending > 0 || counts.expired > 0 || expiring.length > 0) && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-semibold text-amber-900">
                {t('admin.attention')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {counts.pending > 0 && (
                <button
                  onClick={() => setStatusFilter('pending')}
                  className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition"
                >
                  {counts.pending} {t('admin.pending')}
                </button>
              )}
              {counts.expired > 0 && (
                <button
                  onClick={() => setStatusFilter('expired')}
                  className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-[11px] font-medium text-orange-800 hover:bg-amber-100 transition"
                >
                  {counts.expired} {t('admin.statusExpired')}
                </button>
              )}
              {expiring.length > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-[11px] font-medium text-amber-900">
                  {expiring.length} {t('admin.expiringSoon')}
                </span>
              )}
            </div>
          </section>
        )}

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[92px] bg-white border border-zinc-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          stats && (
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link href="/admin/live">
                <StatCard
                  label={t('admin.stats.today')}
                  value={stats.ordersToday}
                  icon={<ShoppingBag className="w-4 h-4" />}
                />
              </Link>
              <Link href="/admin/live">
                <StatCard
                  label={t('admin.stats.total')}
                  value={stats.totalOrders}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
              </Link>
              <Link href="/admin/billing">
                <StatCard
                  label={t('admin.stats.shops')}
                  value={stats.totalShops}
                  hint={
                    expiring.length ? `${expiring.length} ${t('admin.expiringSoon')}` : undefined
                  }
                  icon={<Store className="w-4 h-4" />}
                />
              </Link>
              <Link href="/admin/reviews">
                <StatCard
                  label={t('admin.stats.rating')}
                  value={Number(stats.avgRating)}
                  suffix="★"
                  icon={<Star className="w-4 h-4" />}
                />
              </Link>
            </section>
          )
        )}

        {/* SEARCH + FILTERS */}
        <section className="space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('admin.search')}
          />

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ['all', t('admin.all')],
                ['pending', t('admin.pending')],
                ['active', t('admin.active')],
                ['expired', t('admin.statusExpired')],
                ['disabled', t('admin.disabled')],
              ] as const
            ).map(([id, label]) => {
              const isActive = statusFilter === id
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition border ${
                    isActive
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {label}
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-zinc-700 text-white' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {counts[id]}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* LIST */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">
              {t('admin.cafes')}
            </h2>
            <span className="text-[11px] text-zinc-500 tabular-nums">
              {filtered.length} / {shops.length}
            </span>
          </div>

          {loading ? (
            <div className="bg-white border border-zinc-200 rounded-lg divide-y divide-zinc-100">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-md bg-zinc-100 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-2.5 w-48 bg-zinc-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : shops.length === 0 ? (
            <EmptyState title={t('admin.noCafes')} description={t('admin.noCafesHint')} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={formatTemplate(t('admin.noMatches'), { query })}
              description=""
              action={
                <button
                  onClick={() => setQuery('')}
                  className="mt-3 text-sm text-zinc-600 hover:text-zinc-900 underline"
                >
                  {t('admin.clearSearch')}
                </button>
              }
            />
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100">
              {filtered.map((shop) => (
                <ShopRow key={shop.id} shop={shop} t={t} />
              ))}
            </div>
          )}
        </section>
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function ShopRow({ shop, t }: { shop: Shop; t: (k: never) => string }) {
  const last = shop.stats.last_order_at
    ? new Date(shop.stats.last_order_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : t('admin.never' as never)

  return (
    <Link
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-900 truncate">
              {shop.name}
            </span>
            <StateBadge status={shop.status} t={t} />
            {shop.status === 'active' &&
              typeof shop.days_left === 'number' &&
              shop.days_left <= 7 && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    shop.days_left <= 3
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {shop.days_left === 0
                    ? t('admin.endsToday' as never)
                    : `${shop.days_left}d`}
                </span>
              )}
          </div>

          <div className="text-xs text-zinc-500 truncate">
            {shop.tagline || t('admin.noTagline' as never)}
          </div>

          <div className="text-[10px] text-zinc-400 mt-0.5">
            {t('admin.lastOrder' as never)}: {last}
          </div>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-6 shrink-0 text-xs text-zinc-500 tabular-nums">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            30d
          </div>
          <div className="text-sm font-medium text-zinc-900">{shop.stats.last30}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            {t('admin.stats.total' as never)}
          </div>
          <div className="text-sm font-medium text-zinc-900">{shop.stats.total}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition rtl:rotate-180" />
      </div>
    </Link>
  )
}

function StatCard({
  label,
  value,
  suffix,
  hint,
  icon,
}: {
  label: string
  value: number
  suffix?: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:border-zinc-400 hover:bg-zinc-50 transition h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
          {label}
        </span>
        <span className="text-zinc-400">{icon}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-none">
        {value}
        {suffix && <span className="text-sm text-zinc-400 ms-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[10px] text-amber-600 font-medium mt-1.5">{hint}</div>}
    </div>
  )
}

function StateBadge({
  status,
  t,
}: {
  status: ShopStatus
  t: (k: never) => string
}) {
  const base =
    'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded'
  if (status === 'disabled')
    return (
      <span className={`${base} bg-red-50 text-red-600`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {t('admin.statusDisabled' as never)}
      </span>
    )
  if (status === 'pending')
    return (
      <span className={`${base} bg-amber-50 text-amber-700`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {t('admin.statusPending' as never)}
      </span>
    )
  if (status === 'expired')
    return (
      <span className={`${base} bg-orange-50 text-orange-700`}>
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        {t('admin.statusExpired' as never)}
      </span>
    )
  return (
    <span className={`${base} bg-emerald-50 text-emerald-700`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {t('admin.statusActive' as never)}
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
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {action}
    </div>
  )
}