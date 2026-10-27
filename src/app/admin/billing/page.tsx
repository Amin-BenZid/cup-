'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminShell'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  adminFetch,
  Button,
  Card,
  cx,
  Empty,
  ErrorBanner,
  fmtDate,
  inputCls,
  PageHeader,
  Pill,
  Segmented,
  ShopAvatar,
  Skeleton,
  Stat,
  StateBadge,
  useAdminData,
  type ShopState,
} from '@/components/admin/ui'
import { MONTHLY_PRICE_TND } from '@/lib/config'

type Shop = {
  id: string
  name: string
  code: string
  phone: string | null
  status: ShopState
  logo_url: string | null
  is_trial: boolean
  days_left: number
  trial_ends_at: string | null
  subscription_ends_at: string | null
  paid_current_month: boolean | null
}

type Filter = 'attention' | 'trial' | 'paying' | 'expired' | 'unpaid' | 'all'

function reminderLink(s: Shop) {
  if (!s.phone) return null
  const msg = `Bonjour ${s.name}, c'est l'équipe Beep. Votre abonnement arrive à échéance. Souhaitez-vous continuer ?`
  return `https://wa.me/${s.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`
}

export default function BillingPage() {
  const { toast } = useAdmin()
  const { data, error, loading, reload } = useAdminData<{ shops: Shop[] }>('/api/admin/shops')
  const [filter, setFilter] = useState<Filter>('attention')
  const [q, setQ] = useState('')
  const [pending, setPending] = useState<{ shop: Shop; months: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const shops = useMemo(() => (data?.shops ?? []).filter((s) => s.status !== 'pending'), [data])

  const groups = useMemo(() => {
    const paying = shops.filter((s) => s.status === 'active' && !s.is_trial)
    const trial = shops.filter((s) => s.status === 'active' && s.is_trial)
    const expired = shops.filter((s) => s.status === 'expired')
    const attention = shops.filter((s) => s.status === 'expired' || (s.status === 'active' && s.days_left <= 7))
    const unpaid = shops.filter((s) => s.status === 'active' && !s.is_trial && !s.paid_current_month)
    return { paying, trial, expired, attention, unpaid, all: shops }
  }, [shops])

  const list = groups[filter]
    .filter((s) => !q.trim() || `${s.name} ${s.code}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.days_left - b.days_left)

  async function extend() {
    if (!pending) return
    setBusy(true)
    const r = await adminFetch(`/api/admin/shops/${pending.shop.id}/billing`, { method: 'POST', body: { months: pending.months } })
    setBusy(false)
    const p = pending
    setPending(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', `${p.shop.name}: +${p.months} month${p.months > 1 ? 's' : ''}`)
    void reload()
  }

  return (
    <div>
      <PageHeader title="Billing" subtitle={`${MONTHLY_PRICE_TND} TND / café / month`} />
      <ErrorBanner message={error} onRetry={reload} />

      <div className="grid grid-cols-2 [&>*]:min-w-0 lg:grid-cols-4 gap-3 mb-5">
        {loading && !data ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)
        ) : (
          <>
            <Stat label="MRR (est.)" value={`${groups.paying.length * MONTHLY_PRICE_TND} TND`} hint={`${groups.paying.length} paying`} />
            <Stat label="On trial" value={groups.trial.length} hint="could convert" />
            <Stat label="Needs attention" value={groups.attention.length} tone={groups.attention.length ? 'warn' : 'default'} hint="expired or ≤7 days" />
            <Stat label="Unpaid this month" value={groups.unpaid.length} tone={groups.unpaid.length ? 'bad' : 'default'} />
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search café" className={cx(inputCls, 'ps-9')} />
        </div>
      </div>
      <div className="mb-3">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'attention', label: 'Needs attention', count: groups.attention.length },
            { value: 'unpaid', label: 'Unpaid', count: groups.unpaid.length },
            { value: 'trial', label: 'Trial', count: groups.trial.length },
            { value: 'paying', label: 'Paying', count: groups.paying.length },
            { value: 'expired', label: 'Expired', count: groups.expired.length },
            { value: 'all', label: 'All', count: groups.all.length },
          ]}
        />
      </div>

      <Card padded={false}>
        {loading && !data ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : list.length === 0 ? (
          <Empty title="Nothing here" hint={filter === 'attention' ? 'No café is expiring soon. 🎉' : undefined} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {list.map((s) => {
              const wa = reminderLink(s)
              return (
                <li key={s.id} className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                  <Link href={`/admin/shops/${s.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <ShopAvatar name={s.name} logo={s.logo_url} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{s.name}</span>
                        <StateBadge state={s.status} trial={s.is_trial} />
                        {s.status === 'active' && !s.is_trial && !s.paid_current_month && <Pill className="bg-red-100 text-red-700">unpaid</Pill>}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {s.is_trial ? `Trial ends ${fmtDate(s.trial_ends_at)}` : `Paid until ${fmtDate(s.subscription_ends_at)}`}
                        {' · '}
                        <span className={cx('tabular-nums', s.status === 'expired' ? 'text-orange-600' : s.days_left <= 3 ? 'text-red-600' : s.days_left <= 7 ? 'text-amber-600' : '')}>
                          {s.status === 'expired' ? 'expired' : `${s.days_left}d left`}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100" title="WhatsApp reminder">
                        <MessageCircle className="w-3.5 h-3.5" /> Remind
                      </a>
                    )}
                    {[1, 3, 12].map((m) => (
                      <Button key={m} size="sm" onClick={() => setPending({ shop: s, months: m })}>
                        +{m}m
                      </Button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={extend}
        loading={busy}
        variant="default"
        title={pending ? `Extend ${pending.shop.name} by ${pending.months} month${pending.months > 1 ? 's' : ''}?` : ''}
        description="Adds time from the current end date (or today if it already ended) and marks this month as paid."
        confirmLabel="Extend"
      />
    </div>
  )
}
