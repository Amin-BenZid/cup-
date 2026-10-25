'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Card,
  cx,
  Empty,
  ErrorBanner,
  fmtDate,
  inputCls,
  PageHeader,
  Segmented,
  ShopAvatar,
  Skeleton,
  Stat,
  useAdminData,
} from '@/components/admin/ui'

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  shop_id: string
  shops: { name: string; logo_url: string | null } | null
}

const FACES = ['', '😞', '🙂', '😍']
const LABEL = ['', 'Bad', 'OK', 'Great']

export default function ReviewsPage() {
  const { data, error, loading, reload } = useAdminData<{ reviews: Review[] }>('/api/admin/reviews', { pollMs: 60_000 })
  const [rating, setRating] = useState<'all' | '1' | '2' | '3'>('all')
  const [withComment, setWithComment] = useState(false)
  const [q, setQ] = useState('')

  const reviews = useMemo(() => data?.reviews ?? [], [data])
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0
  const dist = [1, 2, 3].map((r) => reviews.filter((x) => x.rating === r).length)

  const list = reviews.filter((r) => {
    if (rating !== 'all' && r.rating !== Number(rating)) return false
    if (withComment && !r.comment) return false
    const query = q.trim().toLowerCase()
    if (query && !`${r.shops?.name ?? ''} ${r.comment ?? ''}`.toLowerCase().includes(query)) return false
    return true
  })

  return (
    <div>
      <PageHeader title="Reviews" subtitle={`Latest ${reviews.length} customer ratings`} />
      <ErrorBanner message={error} onRetry={reload} />

      <div className="grid grid-cols-2 [&>*]:min-w-0 lg:grid-cols-4 gap-3 mb-5">
        {loading && !data ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Stat label="Average" value={reviews.length ? `${avg.toFixed(2)} / 3` : '—'} />
            {[3, 2, 1].map((r) => (
              <Stat
                key={r}
                label={`${FACES[r]} ${LABEL[r]}`}
                value={dist[r - 1]}
                hint={reviews.length ? `${Math.round((dist[r - 1] / reviews.length) * 100)}%` : undefined}
                tone={r === 1 && dist[0] > 0 ? 'warn' : 'default'}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search café or comment" className={cx(inputCls, 'ps-9')} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 px-1">
          <input type="checkbox" checked={withComment} onChange={(e) => setWithComment(e.target.checked)} className="rounded" />
          Only with comments
        </label>
      </div>
      <div className="mb-3">
        <Segmented
          value={rating}
          onChange={setRating}
          options={[
            { value: 'all', label: 'All', count: reviews.length },
            { value: '1', label: `${FACES[1]} Bad`, count: dist[0] },
            { value: '2', label: `${FACES[2]} OK`, count: dist[1] },
            { value: '3', label: `${FACES[3]} Great`, count: dist[2] },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : list.length === 0 ? (
          <Empty title="No reviews match" />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {list.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <span className="text-2xl leading-none">{FACES[r.rating]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-800 break-words">{r.comment || <span className="text-zinc-400">No comment</span>}</div>
                  <Link href={`/admin/shops/${r.shop_id}`} className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
                    <ShopAvatar name={r.shops?.name ?? '?'} logo={r.shops?.logo_url} size={16} />
                    {r.shops?.name ?? 'Deleted café'} · {fmtDate(r.created_at, true)}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
