'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  Button,
  Card,
  cx,
  duration,
  Empty,
  ErrorBanner,
  inputCls,
  OrderStatus,
  PageHeader,
  Segmented,
  ShopAvatar,
  Skeleton,
  Stat,
  timeAgo,
  useAdminData,
  useNow,
} from '@/components/admin/ui'

type Order = {
  id: string
  order_number: string
  status: 'preparing' | 'ready' | 'done'
  created_at: string
  ready_at: string | null
  customer_connected: boolean
  shop_id: string
  shops: { name: string; logo_url: string | null } | null
}

type Filter = 'open' | 'preparing' | 'ready' | 'all'

export default function LivePage() {
  const { toast } = useAdmin()
  const { data, error, loading, reload } = useAdminData<{ orders: Order[] }>('/api/admin/live', { pollMs: 4000 })
  const [filter, setFilter] = useState<Filter>('open')
  const [shopId, setShopId] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const now = useNow(1000)

  const orders = useMemo(() => data?.orders ?? [], [data])
  const shops = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of orders) m.set(o.shop_id, o.shops?.name ?? 'Unknown')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [orders])

  const list = orders.filter((o) => {
    if (filter === 'open' && o.status === 'done') return false
    if ((filter === 'preparing' || filter === 'ready') && o.status !== filter) return false
    if (shopId && o.shop_id !== shopId) return false
    const query = q.trim().toLowerCase()
    if (query && !`${o.order_number} ${o.shops?.name ?? ''}`.toLowerCase().includes(query)) return false
    return true
  })

  const open = orders.filter((o) => o.status !== 'done')
  const prepTimes = orders.filter((o) => o.ready_at).map((o) => (new Date(o.ready_at!).getTime() - new Date(o.created_at).getTime()) / 1000)
  const avgPrep = prepTimes.length ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : null

  async function close(o: Order) {
    setBusy(o.id)
    const r = await adminFetch(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status: 'done' } })
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', `#${o.order_number} closed`)
    void reload()
  }

  return (
    <div>
      <PageHeader
        title="Live orders"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Updates every 4 seconds · last 100 orders
          </span>
        }
      />
      <ErrorBanner message={error} onRetry={reload} />

      <div className="grid grid-cols-3 [&>*]:min-w-0 gap-2 sm:gap-3 mb-4">
        <Stat label="Preparing" value={open.filter((o) => o.status === 'preparing').length} />
        <Stat label="Ready" value={open.filter((o) => o.status === 'ready').length} />
        <Stat label="Avg prep" value={duration(avgPrep)} hint="last 100" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order # or café" className={cx(inputCls, 'ps-9')} />
        </div>
        <select value={shopId} onChange={(e) => setShopId(e.target.value)} className={cx(inputCls, 'sm:w-56')}>
          <option value="">All cafés</option>
          {shops.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: open.length },
            { value: 'preparing', label: 'Preparing' },
            { value: 'ready', label: 'Ready' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : list.length === 0 ? (
          <Empty title="Nothing here right now" />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {list.map((o) => {
              const age = (now - new Date(o.created_at).getTime()) / 1000
              const stuck = o.status !== 'done' && age > 3 * 3600
              return (
                <li key={o.id} className={cx('flex items-center gap-3 px-4 py-2.5', stuck && 'bg-red-50/50')}>
                  <ShopAvatar name={o.shops?.name ?? '?'} logo={o.shops?.logo_url} size={30} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold tabular-nums">#{o.order_number}</span>
                      <Link href={`/admin/shops/${o.shop_id}`} className="truncate text-zinc-600 hover:underline">
                        {o.shops?.name ?? 'Unknown café'}
                      </Link>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {timeAgo(o.created_at)}
                      {o.status === 'preparing' && ` · waiting ${duration(age)}`}
                      {o.ready_at && ` · ready in ${duration((new Date(o.ready_at).getTime() - new Date(o.created_at).getTime()) / 1000)}`}
                      {' · '}
                      <span className={o.customer_connected ? 'text-emerald-600' : ''}>{o.customer_connected ? 'scanned' : 'not scanned'}</span>
                      {stuck && <span className="text-red-600"> · stuck</span>}
                    </div>
                  </div>
                  <OrderStatus status={o.status} />
                  <a href={`/o/${o.id}`} target="_blank" rel="noreferrer" className="hidden sm:block p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100" title="Customer page">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {o.status !== 'done' && (
                    <Button size="sm" variant="ghost" loading={busy === o.id} onClick={() => close(o)}>
                      Close
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
