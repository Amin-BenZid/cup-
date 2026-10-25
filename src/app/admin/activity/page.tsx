'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import {
  Card,
  cx,
  Empty,
  ErrorBanner,
  fmtDate,
  PageHeader,
  Segmented,
  Skeleton,
  timeAgo,
  useAdminData,
  useNow,
} from '@/components/admin/ui'
import { describeAudit, describeHistory } from '@/components/admin/history'

type Activity = {
  history: { id: string; action: string; details: unknown; created_at: string; shop_id: string; shop_name: string | null }[]
  audit: { at: string; event: string; ok: boolean; ip: string; ua: string; details?: Record<string, unknown> }[]
}

function device(ua: string) {
  if (!ua) return ''
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Other'
}

export default function ActivityPage() {
  const [tab, setTab] = useState<'cafes' | 'admin'>('cafes')
  const { data, error, loading, reload } = useAdminData<Activity>('/api/admin/activity', { pollMs: 60_000 })
  const now = useNow(60_000)
  const failed24h = (data?.audit ?? []).filter((a) => !a.ok && a.event === 'login_failed' && now - new Date(a.at).getTime() < 86400_000).length

  return (
    <div>
      <PageHeader title="Activity log" subtitle="What happened, and who did it" />
      <ErrorBanner message={error} onRetry={reload} />

      {failed24h > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <ShieldAlert className="w-4 h-4" />
          {failed24h} failed admin sign-in attempt{failed24h > 1 ? 's' : ''} in the last 24 h. Check the “Admin & security” tab.
        </div>
      )}

      <div className="mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'cafes', label: 'Cafés', count: data?.history.length },
            { value: 'admin', label: 'Admin & security', count: data?.audit.length },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : tab === 'cafes' ? (
          !data?.history.length ? (
            <Empty title="No café activity yet" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0 truncate">
                    <Link href={`/admin/shops/${h.shop_id}`} className="font-medium hover:underline">
                      {h.shop_name ?? 'Deleted café'}
                    </Link>{' '}
                    <span className="text-zinc-600">{describeHistory(h.action, h.details)}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 shrink-0" title={fmtDate(h.created_at, true)}>
                    {timeAgo(h.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : !data?.audit.length ? (
          <Empty title="No admin events yet" hint="Sign-ins and admin actions are recorded from now on." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.audit.map((a, i) => (
              <li key={i} className={cx('flex items-center gap-3 px-4 py-2.5 text-sm', !a.ok && 'bg-red-50/50')}>
                {a.ok ? <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className={cx('truncate', !a.ok && 'text-red-700')}>{describeAudit(a.event, a.details)}</div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {a.ip}
                    {a.ua && ` · ${device(a.ua)}`}
                  </div>
                </div>
                <span className="text-[11px] text-zinc-400 shrink-0" title={fmtDate(a.at, true)}>
                  {timeAgo(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
