'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronRight, Lock, Search } from 'lucide-react'
import {
  Card,
  cx,
  Empty,
  ErrorBanner,
  inputCls,
  PageHeader,
  Pill,
  Segmented,
  ShopAvatar,
  Skeleton,
  StateBadge,
  timeAgo,
  useAdminData,
  type ShopState,
} from '@/components/admin/ui'

type Shop = {
  id: string
  name: string
  code: string
  tagline: string | null
  phone: string | null
  status: ShopState
  created_at: string
  logo_url: string | null
  is_trial: boolean
  days_left: number
  locked: boolean
  has_created_order: boolean | null
  archived?: boolean
  archived_at?: string | null
  stats: { total: number; last7: number; last30: number; today: number; last_order_at: string | null; rating: number; rating_count: number }
}

type Filter = 'all' | ShopState | 'trial' | 'archived'
type Sort = 'newest' | 'orders' | 'last_order' | 'days_left' | 'name'

export default function ShopsPage() {
  const { data, error, loading, reload } = useAdminData<{ shops: Shop[] }>('/api/admin/shops', { pollMs: 60_000 })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('newest')

  const allShops = useMemo(() => data?.shops ?? [], [data])
  // Archived cafés only show under the Archived filter.
  const shops = useMemo(() => allShops.filter((s) => !s.archived), [allShops])
  const archived = useMemo(() => allShops.filter((s) => s.archived), [allShops])

  const counts = useMemo(
    () => ({
      all: shops.length,
      pending: shops.filter((s) => s.status === 'pending').length,
      active: shops.filter((s) => s.status === 'active' && !s.is_trial).length,
      trial: shops.filter((s) => s.status === 'active' && s.is_trial).length,
      expired: shops.filter((s) => s.status === 'expired').length,
      disabled: shops.filter((s) => s.status === 'disabled').length,
      archived: archived.length,
    }),
    [shops, archived],
  )

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    const source = filter === 'archived' ? archived : shops
    const out = source.filter((s) => {
      if (filter === 'trial' && !(s.status === 'active' && s.is_trial)) return false
      if (filter === 'active' && !(s.status === 'active' && !s.is_trial)) return false
      if (filter !== 'all' && filter !== 'trial' && filter !== 'active' && filter !== 'archived' && s.status !== filter) return false
      if (!query) return true
      return [s.name, s.code, s.tagline ?? '', s.phone ?? ''].join(' ').toLowerCase().includes(query)
    })
    const by: Record<Sort, (a: Shop, b: Shop) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
      orders: (a, b) => b.stats.last30 - a.stats.last30,
      last_order: (a, b) => (b.stats.last_order_at ?? '').localeCompare(a.stats.last_order_at ?? ''),
      days_left: (a, b) => a.days_left - b.days_left,
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return out.sort(by[sort])
  }, [shops, archived, q, filter, sort])

  return (
    <div>
      <PageHeader title="Cafés" subtitle={`${shops.length} total`} />
      <ErrorBanner message={error} onRetry={reload} />

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code, phone…"
            className={cx(inputCls, 'ps-9')}
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cx(inputCls, 'sm:w-48')}>
          <option value="newest">Newest first</option>
          <option value="orders">Most orders (30d)</option>
          <option value="last_order">Last order</option>
          <option value="days_left">Days left</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="mb-4">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'active', label: 'Paying', count: counts.active },
            { value: 'trial', label: 'Trial', count: counts.trial },
            { value: 'expired', label: 'Expired', count: counts.expired },
            { value: 'disabled', label: 'Disabled', count: counts.disabled },
            { value: 'archived', label: 'Archived', count: counts.archived || undefined },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <div className="p-4 space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : list.length === 0 ? (
          filter === 'archived' && !archived.length ? (
            <Empty title="Nothing archived" hint="Archive a café from its page (Edit & access → Danger zone)." />
          ) : (
            <Empty title={shops.length ? 'No cafés match' : 'No cafés yet'} hint={shops.length ? 'Try another filter or search.' : 'New sign-ups will show up here.'} />
          )
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1fr_110px_80px_80px_120px_20px] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              <span>Café</span>
              <span>Status</span>
              <span className="text-end">Today</span>
              <span className="text-end">30 days</span>
              <span className="text-end">Last order</span>
              <span />
            </div>
            <ul className="divide-y divide-zinc-100">
              {list.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/shops/${s.id}`}
                    className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_110px_80px_80px_120px_20px] gap-3 items-center px-4 py-3 hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ShopAvatar name={s.name} logo={s.logo_url} size={36} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                          {s.name}
                          {s.locked && <Lock className="w-3 h-3 text-red-500" aria-label="Login locked" />}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {s.code}
                          {s.status === 'active' && s.days_left <= 7 && (
                            <span className={s.days_left <= 3 ? 'text-red-600' : 'text-amber-600'}>
                              {' '}· {s.days_left === 0 ? 'ends today' : `${s.days_left}d left`}
                            </span>
                          )}
                          {!s.has_created_order && s.status === 'active' && <span className="text-zinc-400"> · no orders yet</span>}
                        </div>
                      </div>
                    </div>
                    <div className="md:hidden flex flex-col items-end gap-1">
                      {s.archived ? <Pill className="bg-zinc-800 text-white">Archived</Pill> : <StateBadge state={s.status} trial={s.is_trial} />}
                      <span className="text-[11px] text-zinc-500 tabular-nums">{s.stats.last30} / 30d</span>
                    </div>
                    <div className="hidden md:block">
                      {s.archived ? <Pill className="bg-zinc-800 text-white">Archived</Pill> : <StateBadge state={s.status} trial={s.is_trial} />}
                    </div>
                    <div className="hidden md:block text-end text-sm tabular-nums">{s.stats.today || <span className="text-zinc-300">0</span>}</div>
                    <div className="hidden md:block text-end text-sm tabular-nums">{s.stats.last30}</div>
                    <div className="hidden md:block text-end text-xs text-zinc-500">{s.stats.last_order_at ? timeAgo(s.stats.last_order_at) : <Pill>never</Pill>}</div>
                    <ChevronRight className="hidden md:block w-4 h-4 text-zinc-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}
