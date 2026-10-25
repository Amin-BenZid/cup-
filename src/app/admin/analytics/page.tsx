'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  BarChart,
  Card,
  dayLabel,
  duration,
  Empty,
  ErrorBanner,
  PageHeader,
  Segmented,
  ShopAvatar,
  Skeleton,
  Stat,
  useAdminData,
} from '@/components/admin/ui'

type Analytics = {
  days: number
  totals: {
    orders: number
    avgPerDay: number
    avgPrepSec: number | null
    connectRate: number | null
    reviews: number
    avgRating: number | null
    signups: number
    activeShops: number
  }
  series: { day: string; orders: number; signups: number; avgPrepSec: number | null }[]
  hours: number[]
  ratingDist: number[]
  leaderboard: {
    shop_id: string
    name: string
    logo_url: string | null
    orders: number
    avgPrepSec: number | null
    connectRate: number | null
    rating: number | null
    reviews: number
  }[]
  truncated: boolean
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const { data, error, loading, reload } = useAdminData<Analytics>(`/api/admin/analytics?days=${days}`)
  const t = data?.totals
  const every = days === '7' ? 1 : days === '30' ? 5 : 15

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="How the app is being used"
        actions={
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7d' },
              { value: '30', label: '30d' },
              { value: '90', label: '90d' },
            ]}
          />
        }
      />
      <ErrorBanner message={error} onRetry={reload} />
      {data?.truncated && <div className="mb-3 text-xs text-amber-700">Showing the first 50,000 orders of this period.</div>}

      <div className="grid grid-cols-2 [&>*]:min-w-0 lg:grid-cols-4 gap-3 mb-5">
        {loading && !t ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)
        ) : t ? (
          <>
            <Stat label="Orders" value={t.orders.toLocaleString()} hint={`${t.avgPerDay} / day · ${t.activeShops} active cafés`} />
            <Stat label="Avg prep time" value={duration(t.avgPrepSec)} hint="order → ready" />
            <Stat label="Scan rate" value={t.connectRate === null ? '—' : `${t.connectRate}%`} hint="customers who opened their page" />
            <Stat label="Rating" value={t.avgRating === null ? '—' : `${t.avgRating} / 3`} hint={`${t.reviews} reviews · ${t.signups} new cafés`} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 [&>*]:min-w-0 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Orders per day">
          {data ? (
            <BarChart labelEvery={every} data={data.series.map((s) => ({ label: dayLabel(s.day), value: s.orders, title: dayLabel(s.day, false) }))} />
          ) : (
            <Skeleton className="h-[170px]" />
          )}
        </Card>
        <Card title="Average prep time per day">
          {data ? (
            <BarChart
              labelEvery={every}
              color="#d97706"
              format={(v) => duration(v)}
              data={data.series.map((s) => ({ label: dayLabel(s.day), value: s.avgPrepSec, title: dayLabel(s.day, false) }))}
            />
          ) : (
            <Skeleton className="h-[170px]" />
          )}
        </Card>
        <Card title="Busiest hours (Tunisia time)">
          {data ? (
            <BarChart labelEvery={3} color="#0284c7" data={data.hours.map((v, h) => ({ label: `${h}h`, value: v, title: `${h}:00–${h}:59` }))} />
          ) : (
            <Skeleton className="h-[170px]" />
          )}
        </Card>
        <Card title="New cafés per day">
          {data ? (
            <BarChart labelEvery={every} color="#059669" data={data.series.map((s) => ({ label: dayLabel(s.day), value: s.signups, title: dayLabel(s.day, false) }))} />
          ) : (
            <Skeleton className="h-[170px]" />
          )}
        </Card>
      </div>

      <Card title="Cafés ranked by orders" padded={false}>
        {!data ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : data.leaderboard.length === 0 ? (
          <Empty title="No orders in this period" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                  <th className="text-start font-medium px-4 py-2">#</th>
                  <th className="text-start font-medium px-2 py-2">Café</th>
                  <th className="text-end font-medium px-2 py-2">Orders</th>
                  <th className="text-end font-medium px-2 py-2">Avg prep</th>
                  <th className="text-end font-medium px-2 py-2">Scan</th>
                  <th className="text-end font-medium px-4 py-2">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.leaderboard.map((r, i) => (
                  <tr key={r.shop_id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2">
                      <Link href={`/admin/shops/${r.shop_id}`} className="flex items-center gap-2 hover:underline">
                        <ShopAvatar name={r.name} logo={r.logo_url} size={24} />
                        <span className="truncate max-w-[180px]">{r.name}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums font-medium">{r.orders}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{duration(r.avgPrepSec)}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{r.connectRate === null ? '—' : `${r.connectRate}%`}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{r.rating === null ? '—' : `${r.rating} (${r.reviews})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
