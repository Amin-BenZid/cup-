'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Trash2,
  AlertCircle,
  Frown,
  Smile,
  Heart,
  History as HistoryIcon,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  CalendarDays,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type ShopState = 'pending' | 'active' | 'expired' | 'disabled'

type Shop = {
  id: string
  name: string
  tagline?: string | null
  status: string
  state?: ShopState
  code?: string | null
  created_at: string
  logo_url?: string | null
  trial_ends_at?: string | null
  subscription_ends_at?: string | null
  billing_status?: string | null
  days_left?: number
  is_trial?: boolean
}

type Order = {
  id: string
  order_number: string
  status: string
  created_at: string
  ready_at: string | null
}

type Review = { rating: number; comment: string | null; created_at: string }
type ReviewStats = { count: number; average: number }
type History = { id: string; action: string; details: unknown; created_at: string }

type Tab = 'overview' | 'orders' | 'feedback'
type OrderFilter = 'all' | 'preparing' | 'ready' | 'done'

export default function AdminShopDetail() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const shopId = typeof params.id === 'string' ? params.id : ''

  const [shop, setShop] = useState<Shop | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ count: 0, average: 0 })
  const [history, setHistory] = useState<History[]>([])

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const [error, setError] = useState('')
  const [newPin, setNewPin] = useState('')

  const [tab, setTab] = useState<Tab>('overview')
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(false)
  const [confirmBilling, setConfirmBilling] = useState<{ months: number } | null>(null)

  const { toasts, push, dismiss } = useToasts()

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/admin/login')
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load')
        return
      }
      setShop(json.shop)
      setOrders(json.orders ?? [])
      setReviews(json.reviews ?? [])
      setReviewStats(json.reviewStats ?? { count: 0, average: 0 })
      setHistory(json.history ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [shopId, router])

  useEffect(() => {
    if (shopId) load()
  }, [shopId, load])

  const state: ShopState = shop?.state ?? ((shop?.status as ShopState) || 'pending')

  async function changeStatus(next: 'active' | 'disabled') {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        push('error', json.error ?? t('common.error'))
        return
      }
      if (json.shop) setShop((prev) => (prev ? { ...prev, ...json.shop } : json.shop))
      push('success', next === 'active' ? t('admin.approve') : t('admin.disable'))
      void load()
    } finally {
      setBusy(false)
      setConfirmStatus(false)
    }
  }

  async function resetPin() {
    if (!/^\d{6}$/.test(newPin)) {
      push('error', t('admin.pinHint'))
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_pin: newPin }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        push('error', json.error ?? t('common.error'))
        return
      }
      setNewPin('')
      push('success', t('admin.saved'))
    } finally {
      setBusy(false)
    }
  }

  async function executeBilling() {
    if (!confirmBilling) return
    const months = confirmBilling.months
    setConfirmBilling(null)
    setBillingBusy(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      })
      if (res.ok) {
        push('success', `+${months}m`)
        await load()
      } else {
        const json = await res.json().catch(() => ({}))
        push('error', json.error ?? t('common.error'))
      }
    } finally {
      setBillingBusy(false)
    }
  }

  async function doDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        push('error', json.error ?? t('common.error'))
        return
      }
      router.push('/admin')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  function expiresIn(dateString?: string | null) {
    if (!dateString) return { text: '—', tone: 'text-zinc-400' }
    const days = Math.ceil(
      (new Date(dateString).getTime() - Date.now()) / 86400000,
    )
    if (days < 0)
      return {
        text: t('admin.expiredAgo', { d: Math.abs(days) }),
        tone: 'text-red-600 font-medium',
      }
    if (days === 0) return { text: t('admin.endsToday'), tone: 'text-amber-600 font-medium' }
    return {
      text: t('admin.daysLeft', { d: days }),
      tone: days <= 7 ? 'text-amber-600 font-medium' : 'text-zinc-500',
    }
  }

  const filteredOrders = useMemo(
    () => (orderFilter === 'all' ? orders : orders.filter((o) => o.status === orderFilter)),
    [orders, orderFilter],
  )

  const orders30 = useMemo(
    () =>
      orders.filter(
        (o) => Date.now() - new Date(o.created_at).getTime() <= 30 * 86400000,
      ).length,
    [orders],
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <div className="h-8 w-40 bg-zinc-200 rounded animate-pulse" />
          <div className="h-24 bg-white border border-zinc-200 rounded-lg animate-pulse" />
          <div className="grid md:grid-cols-3 gap-4">
            <div className="h-20 bg-white border border-zinc-200 rounded-lg animate-pulse" />
            <div className="h-20 bg-white border border-zinc-200 rounded-lg animate-pulse" />
            <div className="h-20 bg-white border border-zinc-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-64 bg-white border border-zinc-200 rounded-lg animate-pulse" />
        </div>
      </main>
    )
  }

  if (!shop) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm text-zinc-600">{error || t('admin.noCafes')}</p>
          <button
            onClick={() => router.push('/admin')}
            className="text-sm underline text-zinc-600"
          >
            {t('common.back')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col pb-24">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition -ms-2 p-2 rounded-md hover:bg-zinc-100"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <CupLogo size={20} />
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6 space-y-6">
        {/* IDENTITY */}
        <section className="bg-white border border-zinc-200 rounded-lg p-5">
          <div className="flex items-start gap-4">
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt=""
                className="w-14 h-14 rounded-lg object-cover border border-zinc-200 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-100 font-semibold text-lg shrink-0">
                {shop.name[0]?.toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold leading-tight truncate">
                  {shop.name}
                </h1>
                <StateBadge state={state} />
                {shop.code && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                    {t('admin.code')}: {shop.code}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500 mt-1 truncate">
                {shop.tagline || t('admin.noTagline')}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" />
                {t('admin.memberSince')}{' '}
                {new Date(shop.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <Kpi
              label={t('admin.tabOrders')}
              value={orders.length}
              hint={`${orders30} · 30d`}
              icon={<ShoppingBag className="w-4 h-4" />}
            />
            <Kpi
              label={t('admin.stats.rating')}
              value={reviewStats.count ? Number(reviewStats.average.toFixed(1)) : 0}
              suffix="★"
              hint={`${reviewStats.count}`}
              icon={<Star className="w-4 h-4" />}
            />
            <Kpi
              label={shop.is_trial ? t('admin.trialEnds') : t('admin.subEnds')}
              value={typeof shop.days_left === 'number' ? shop.days_left : 0}
              suffix="d"
              hint={
                shop.is_trial
                  ? expiresIn(shop.trial_ends_at).text
                  : expiresIn(shop.subscription_ends_at).text
              }
              icon={<CalendarDays className="w-4 h-4" />}
            />
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ['overview', t('admin.tabOverview')],
              ['orders', t('admin.tabOrders')],
              ['feedback', t('admin.tabFeedback')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium border transition ${
                tab === id
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <section className="grid md:grid-cols-2 gap-4">
            <Card icon={<ShieldCheck className="w-4 h-4" />} title={t('admin.management')}>
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-zinc-500 mb-2">
                    {state === 'active'
                      ? t('admin.accessActive')
                      : state === 'pending'
                        ? t('admin.accessPending')
                        : t('admin.accessDisabled')}
                  </p>
                  <div className="flex items-center gap-2">
                    {state === 'pending' ? (
                      <>
                        <button
                          onClick={() => changeStatus('active')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition"
                        >
                          {t('admin.approve')}
                        </button>
                        <button
                          onClick={() => changeStatus('disabled')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                        >
                          {t('admin.decline')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmStatus(true)}
                        disabled={busy}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50 ${
                          state === 'disabled'
                            ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                            : 'border border-zinc-200 text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {state === 'disabled' ? t('admin.enable') : t('admin.disable')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2 flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3" /> {t('admin.resetPin')}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) =>
                        setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="••••••"
                      className="flex-1 px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition tracking-widest font-mono"
                    />
                    <button
                      onClick={resetPin}
                      disabled={busy || newPin.length !== 6}
                      className="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-40 transition"
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : t('admin.savePin')}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1.5">{t('admin.pinHint')}</p>
                </div>
              </div>
            </Card>

            <Card icon={<CreditCard className="w-4 h-4" />} title={t('admin.billing')}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">
                      {t('admin.trialEnds')}
                    </div>
                    <div className="text-zinc-900 font-medium">
                      {shop.trial_ends_at
                        ? new Date(shop.trial_ends_at).toLocaleDateString()
                        : '—'}
                    </div>
                    <div className={`text-[10px] ${expiresIn(shop.trial_ends_at).tone}`}>
                      {expiresIn(shop.trial_ends_at).text}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">
                      {t('admin.subEnds')}
                    </div>
                    <div className="text-zinc-900 font-medium">
                      {shop.subscription_ends_at
                        ? new Date(shop.subscription_ends_at).toLocaleDateString()
                        : '—'}
                    </div>
                    <div className={`text-[10px] ${expiresIn(shop.subscription_ends_at).tone}`}>
                      {expiresIn(shop.subscription_ends_at).text}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100">
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                    {t('admin.extend')}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setConfirmBilling({ months: m })}
                        disabled={billingBusy}
                        className="px-2 py-1.5 rounded-md border border-zinc-200 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 transition"
                      >
                        +{m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <Card
            icon={<ShoppingBag className="w-4 h-4" />}
            title={t('admin.recentOrders')}
            right={
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {filteredOrders.length}
              </span>
            }
          >
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(['all', 'preparing', 'ready', 'done'] as OrderFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`shrink-0 px-3 py-1 rounded-md text-[11px] font-medium transition border ${
                    orderFilter === f
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {f === 'all' ? t('admin.all') : f}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">
                {t('admin.orderNoMatch')}
              </p>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                {filteredOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold tabular-nums w-14">
                        #{o.order_number}
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {new Date(o.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* FEEDBACK */}
        {tab === 'feedback' && (
          <section className="grid md:grid-cols-2 gap-4">
            <Card
              icon={<Heart className="w-4 h-4" />}
              title={t('admin.reviews')}
              right={
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {reviewStats.count
                    ? `${reviewStats.average.toFixed(1)} ★ · ${reviewStats.count}`
                    : '—'}
                </span>
              }
            >
              {reviews.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">
                  {t('admin.noReviews')}
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                  {reviews.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5">
                      <div className="shrink-0 mt-0.5">
                        {r.rating <= 1 ? (
                          <Frown className="w-3.5 h-3.5 text-red-500" />
                        ) : r.rating === 2 ? (
                          <Smile className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Heart className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-900">
                          {r.comment || <span className="italic text-zinc-400">—</span>}
                        </p>
                        <p className="text-[10px] text-zinc-500 tabular-nums">
                          {new Date(r.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card
              icon={<HistoryIcon className="w-4 h-4" />}
              title={t('admin.activity')}
              right={
                <span className="text-[11px] text-zinc-500 tabular-nums">
                  {history.length}
                </span>
              }
            >
              {history.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">
                  {t('admin.noActivity')}
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 py-2.5">
                      <div className="shrink-0 mt-0.5">
                        {h.action === 'approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : h.action === 'disabled' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        ) : h.action === 'pin_reset' ? (
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        ) : h.action === 'billing_extended' ? (
                          <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-900 capitalize">
                          {h.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-zinc-500 tabular-nums">
                          {new Date(h.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* DANGER */}
        <section className="bg-white border border-red-200 rounded-lg">
          <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700">
              {t('admin.dangerZone')}
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-zinc-500">{t('admin.deleteWarning')}</p>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('admin.deleteCafe')}
            </button>
          </div>
        </section>
      </div>

      {/* DIALOGS */}
      <ConfirmDialog
        open={!!confirmBilling}
        onClose={() => setConfirmBilling(null)}
        onConfirm={executeBilling}
        title={`${t('admin.extend')} +${confirmBilling?.months}m`}
        description={t('admin.subEnds')}
        confirmLabel={t('admin.extend')}
        cancelLabel={t('admin.cancel')}
        variant="default"
        loading={billingBusy}
      />
      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={() => changeStatus(state === 'disabled' ? 'active' : 'disabled')}
        title={state === 'disabled' ? t('admin.confirmEnable') : t('admin.confirmDisable')}
        description={
          state === 'disabled' ? t('admin.confirmEnableDesc') : t('admin.confirmDisableDesc')
        }
        confirmLabel={state === 'disabled' ? t('admin.enable') : t('admin.disable')}
        cancelLabel={t('admin.cancel')}
        variant={state === 'disabled' ? 'default' : 'danger'}
        loading={busy}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={`${t('admin.deleteCafe')} — ${shop.name}`}
        description={t('admin.deleteWarning')}
        confirmLabel={t('admin.delete')}
        cancelLabel={t('admin.cancel')}
        loading={busy}
      />

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function Card({
  icon,
  title,
  right,
  children,
}: {
  icon: React.ReactNode
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">{icon}</span>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Kpi({
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
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold truncate">
          {label}
        </span>
        <span className="text-zinc-400">{icon}</span>
      </div>
      <div className="text-xl font-semibold tabular-nums leading-none">
        {value}
        {suffix && <span className="text-xs text-zinc-400 ms-1">{suffix}</span>}
      </div>
      {hint && <div className="text-[10px] text-zinc-500 mt-1 truncate">{hint}</div>}
    </div>
  )
}

function StateBadge({ state }: { state: ShopState }) {
  const base =
    'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded'
  if (state === 'disabled')
    return (
      <span className={`${base} bg-red-100 text-red-700`}>
        <XCircle className="w-3 h-3" /> {String(state)}
      </span>
    )
  if (state === 'pending')
    return (
      <span className={`${base} bg-amber-100 text-amber-800`}>
        <Clock className="w-3 h-3" /> {String(state)}
      </span>
    )
  if (state === 'expired')
    return (
      <span className={`${base} bg-orange-100 text-orange-700`}>
        <AlertCircle className="w-3 h-3" /> {String(state)}
      </span>
    )
  return (
    <span className={`${base} bg-emerald-100 text-emerald-700`}>
      <CheckCircle2 className="w-3 h-3" /> {String(state)}
    </span>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const base = 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded'
  if (status === 'ready') return <span className={`${base} bg-emerald-100 text-emerald-700`}>ready</span>
  if (status === 'done') return <span className={`${base} bg-zinc-100 text-zinc-600`}>done</span>
  return <span className={`${base} bg-amber-100 text-amber-800`}>preparing</span>
}