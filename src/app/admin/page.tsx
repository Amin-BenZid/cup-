'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, ArrowRight, Bug, Check, ChevronRight, MessageSquare, Phone, X } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  BarChart,
  Button,
  Card,
  dayLabel,
  Empty,
  ErrorBanner,
  PageHeader,
  Pill,
  ShopAvatar,
  Skeleton,
  Stat,
  StateBadge,
  timeAgo,
  useAdminData,
  type ShopState,
} from '@/components/admin/ui'
import { describeHistory } from '@/components/admin/history'

type Overview = {
  counts: {
    shops: number
    active: number
    trial: number
    paying: number
    expired: number
    pending: number
    unreadSupport: number
    errors24h: number
    liveOrders: number
    ordersToday: number
    orders7d: number
    ordersPrev7d: number
    mrr: number
  }
  pendingShops: { id: string; name: string; code: string; created_at: string; logo_url: string | null }[]
  expiring: { id: string; name: string; state: ShopState; days_left: number; is_trial: boolean; phone: string | null }[]
  threads: { shop_id: string; shop_name: string; last_message: string; at: string; count: number }[]
  daily: { day: string; count: number }[]
  activity: { id: string; action: string; details: unknown; created_at: string; shop_id: string; shop_name: string | null }[]
}

export default function AdminOverview() {
  const { refreshBadges, toast } = useAdmin()
  const { data, error, loading, reload } = useAdminData<Overview>('/api/admin/overview', { pollMs: 30_000 })
  const [busy, setBusy] = useState<string | null>(null)

  async function setStatus(id: string, status: 'active' | 'disabled', name: string) {
    setBusy(id)
    const r = await adminFetch(`/api/admin/shops/${id}`, { method: 'PATCH', body: { status } })
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', status === 'active' ? `${name} approved` : `${name} declined`)
    void reload()
    refreshBadges()
  }

  const c = data?.counts
  const trend = c ? c.orders7d - c.ordersPrev7d : 0
  const needsAttention =
    !!data && (data.pendingShops.length > 0 || data.threads.length > 0 || data.expiring.length > 0 || (c?.errors24h ?? 0) > 0)

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      />
      <ErrorBanner message={error} onRetry={reload} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {loading && !c ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)
        ) : c ? (
          <>
            <Stat label="Orders today" value={c.ordersToday} hint={`${c.liveOrders} in progress now`} href="/admin/live" />
            <Stat
              label="Orders · 7 days"
              value={c.orders7d}
              hint={
                <span className={trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : ''}>
                  {trend > 0 ? '▲' : trend < 0 ? '▼' : '•'} {Math.abs(trend)} vs previous 7 days
                </span>
              }
              href="/admin/analytics"
            />
            <Stat
              label="Cafés"
              value={c.active}
              hint={`${c.paying} paying · ${c.trial} trial · ${c.expired} expired`}
              href="/admin/shops"
            />
            <Stat label="MRR (est.)" value={`${c.mrr} TND`} hint={`${c.paying} paying cafés`} href="/admin/billing" />
          </>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: attention */}
        <div className="lg:col-span-2 space-y-4">
          {data && !needsAttention && (
            <Card>
              <div className="flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">All clear</div>
                  <div className="text-xs text-zinc-500">No approvals, messages or billing issues waiting.</div>
                </div>
              </div>
            </Card>
          )}

          {data && data.pendingShops.length > 0 && (
            <Card
              title={<span className="flex items-center gap-2">Waiting for approval <Pill className="bg-amber-100 text-amber-800">{data.pendingShops.length}</Pill></span>}
              padded={false}
            >
              <ul className="divide-y divide-zinc-100">
                {data.pendingShops.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <ShopAvatar name={s.name} logo={s.logo_url} />
                    <Link href={`/admin/shops/${s.id}`} className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {s.code} · signed up {timeAgo(s.created_at)}
                      </div>
                    </Link>
                    <Button size="sm" variant="ghost" loading={busy === s.id} onClick={() => setStatus(s.id, 'disabled', s.name)} title="Decline">
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Decline</span>
                    </Button>
                    <Button size="sm" variant="success" loading={busy === s.id} onClick={() => setStatus(s.id, 'active', s.name)}>
                      <Check className="w-3.5 h-3.5" /> Approve
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data && data.threads.length > 0 && (
            <Card
              title={<span className="flex items-center gap-2">Unread messages <Pill className="bg-red-100 text-red-700">{c?.unreadSupport}</Pill></span>}
              action={<Link href="/admin/support" className="text-xs text-zinc-500 hover:text-zinc-900">Inbox →</Link>}
              padded={false}
            >
              <ul className="divide-y divide-zinc-100">
                {data.threads.slice(0, 5).map((t) => (
                  <li key={t.shop_id}>
                    <Link href={`/admin/support?shop=${t.shop_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                      <MessageSquare className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {t.shop_name} {t.count > 1 && <span className="text-zinc-400 font-normal">· {t.count}</span>}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">{t.last_message}</div>
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0">{timeAgo(t.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data && data.expiring.length > 0 && (
            <Card
              title="Billing needs attention"
              action={<Link href="/admin/billing" className="text-xs text-zinc-500 hover:text-zinc-900">Billing →</Link>}
              padded={false}
            >
              <ul className="divide-y divide-zinc-100">
                {data.expiring.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <AlertTriangle className={s.state === 'expired' ? 'w-4 h-4 text-orange-500' : 'w-4 h-4 text-amber-500'} />
                    <Link href={`/admin/shops/${s.id}`} className="flex-1 min-w-0 text-sm truncate hover:underline">
                      {s.name}
                    </Link>
                    <StateBadge state={s.state} trial={s.is_trial} />
                    <span className="text-xs tabular-nums text-zinc-500 w-20 text-end">
                      {s.state === 'expired' ? 'expired' : s.days_left === 0 ? 'ends today' : `${s.days_left}d left`}
                    </span>
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500" title="Call">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {c && c.errors24h > 0 && (
            <Link href="/admin/errors" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100">
              <Bug className="w-4 h-4" />
              <span className="flex-1">
                {c.errors24h} app error{c.errors24h === 1 ? '' : 's'} reported in the last 24 h
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <Card title="Orders · last 14 days" action={<Link href="/admin/analytics" className="text-xs text-zinc-500 hover:text-zinc-900">Analytics →</Link>}>
            {data ? (
              <BarChart data={data.daily.map((d) => ({ label: dayLabel(d.day), value: d.count, title: dayLabel(d.day, false) }))} />
            ) : (
              <Skeleton className="h-[160px]" />
            )}
          </Card>
        </div>

        {/* Right: activity */}
        <Card
          title="Recent activity"
          action={<Link href="/admin/activity" className="text-xs text-zinc-500 hover:text-zinc-900">All →</Link>}
          padded={false}
          className="self-start"
        >
          {!data ? (
            <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : data.activity.length === 0 ? (
            <Empty title="No activity yet" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.activity.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/shops/${a.shop_id}`} className="flex items-start gap-2 px-4 py-2.5 hover:bg-zinc-50">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate">
                        <span className="font-medium">{a.shop_name ?? 'Deleted café'}</span>{' '}
                        <span className="text-zinc-600">{describeHistory(a.action, a.details)}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">{timeAgo(a.created_at)}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-300 mt-1" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
