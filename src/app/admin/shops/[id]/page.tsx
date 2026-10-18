'use client'

import { useCallback, useEffect, useState } from 'react'
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
  Store,
  ShieldCheck,
  History as HistoryIcon,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type Shop = {
  id: string
  name: string
  tagline?: string | null
  status: string
  created_at: string
  logo_url?: string | null
}

type Order = {
  id: string
  order_number: string
  status: string
  created_at: string
  ready_at: string | null
}

type Review = {
  rating: number
  comment: string | null
  created_at: string
}

type ReviewStats = {
  count: number
  average: number
}

type History = {
  id: string
  action: string
  details: any
  created_at: string
}

type OrderFilter = 'all' | 'ready' | 'done' | 'preparing'

export default function AdminShopDetail() {
  const t = useT()
  const router = useRouter()
  const params = useParams()
  const shopId = typeof params.id === 'string' ? params.id : ''

  const [shop, setShop] = useState<Shop | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    count: 0,
    average: 0,
  })
  const [history, setHistory] = useState<History[]>([])
  
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newPin, setNewPin] = useState('')
  
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(false)
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all')

  const { toasts, push, dismiss } = useToasts()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        cache: 'no-store',
      })
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

  async function toggleStatus() {
    if (!shop) return
    const next = shop.status === 'active' ? 'disabled' : 'active'
    await changeStatus(next)
    setConfirmStatus(false)
  }

  async function changeStatus(next: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        push('error', json.error ?? 'Failed to update')
        return
      }
      setShop(json.shop)
      await load()
      const msg = next === 'active' ? 'Approved' : next === 'disabled' ? 'Access disabled' : 'Updated'
      push('success', msg)
    } finally {
      setBusy(false)
    }
  }

  async function resetPin() {
    if (!newPin || newPin.length < 4) {
      push('error', 'PIN must be 4–6 digits')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_pin: newPin }),
      })
      const json = await res.json()
      if (!res.ok) {
        push('error', json.error ?? 'Failed to reset PIN')
        return
      }
      setNewPin('')
      await load()
      push('success', 'PIN updated')
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/shops/${shopId}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        push('error', json.error ?? 'Failed to delete')
        return
      }
      router.push('/admin')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true
    return o.status === orderFilter
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </main>
    )
  }

  if (!shop) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm text-stone-600">{error || 'Shop not found'}</p>
          <button
            onClick={() => router.push('/admin')}
            className="text-sm underline text-stone-600"
          >
            {t('common.back')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition -ml-2 p-2 rounded-lg hover:bg-stone-200/50 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('admin.cafes')}
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center shadow-sm">
              <CupLogo size={18} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* TOP SECTION: Identity + Management */}
        <div className="grid md:grid-cols-2 gap-4">
          
          {/* IDENTITY CARD */}
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm flex flex-col">
            <div className="h-20 bg-stone-100 w-full" />
            <div className="px-5 pb-5 flex-1 flex flex-col">
              <div className="flex items-end justify-between -mt-8 mb-3">
                {shop.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.logo_url}
                    alt=""
                    className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-sm bg-white"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-sm bg-stone-900 flex items-center justify-center text-amber-50 font-bold text-2xl">
                    {(shop.name || 'C')[0].toUpperCase()}
                  </div>
                )}
                <div className="pb-1">
                  <StatusBadge status={shop.status} />
                </div>
              </div>
              
              <h1 className="text-xl font-bold leading-tight">{shop.name}</h1>
              <p className="text-sm text-stone-500 mt-1 flex-1">
                {shop.tagline || '-'}
              </p>
            </div>
          </div>

          {/* MANAGEMENT CARD */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-sm font-semibold border-b border-stone-100 pb-3 mb-4 shrink-0">
              <ShieldCheck className="w-4 h-4 text-stone-400" />
              {t('admin.accessControl')}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              {/* Access */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-stone-700 mb-1">{t('admin.active')}</div>
                  <p className="text-[11px] text-stone-500 mb-3 leading-tight">
                    {shop.status === 'active'
                      ? t('admin.accessActive')
                      : shop.status === 'pending'
                      ? t('admin.accessPending')
                      : t('admin.accessDisabled')}
                  </p>
                </div>

                {shop.status === 'pending' ? (
                  <div className="flex flex-col gap-2 mt-auto">
                    <button
                      onClick={() => changeStatus('active')}
                      disabled={busy}
                      className="w-full px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm inline-flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => changeStatus('disabled')}
                      disabled={busy}
                      className="w-full px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 bg-white border border-stone-200 text-red-600 hover:bg-red-50"
                    >
                      {t('admin.decline')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmStatus(true)}
                    disabled={busy}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-sm mt-auto ${
                      shop.status === 'active'
                        ? 'bg-white border border-stone-200 text-red-600 hover:bg-red-50'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {shop.status === 'active' ? t('admin.disable') : t('admin.enable')}
                  </button>
                )}
              </div>

              {/* Reset PIN */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    {t('admin.resetPin')}
                  </div>
                  <p className="text-[11px] text-stone-500 mb-3 leading-tight">
                    {t('setup.pinHint')}
                  </p>
                </div>
                
                <div className="flex items-center gap-1.5 mt-auto">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="••••"
                    className="w-full px-2 py-2 rounded-lg border border-stone-200 bg-white text-xs outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition tracking-widest font-mono text-center"
                  />
                  <button
                    onClick={resetPin}
                    disabled={busy || newPin.length < 4}
                    className="px-3 py-2 rounded-lg bg-stone-900 text-amber-50 text-xs font-semibold hover:bg-stone-800 disabled:opacity-40 transition"
                  >
                    {t('admin.savePin')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE: History + Reviews */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-stone-400" />
                {t('admin.activity')}
              </div>
              <div className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
                {history.length}
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center flex-1 flex items-center justify-center">
                {t('admin.noActivity')}
              </p>
            ) : (
              <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar flex-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-3 text-sm py-1 border-b border-stone-50 last:border-0"
                  >
                    <div className="shrink-0 mt-0.5">
                      {h.action === 'created' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                      {h.action === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {h.action === 'disabled' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      {h.action === 'pin_reset' && <KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                      {h.action === 'renamed' && <Store className="w-3.5 h-3.5 text-stone-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-800 font-medium capitalize text-xs">
                        {h.action.replace('_', ' ')}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(h.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Heart className="w-4 h-4 text-stone-400" />
                {t('admin.reviews')}
              </div>
              <div className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
                {reviewStats.count > 0
                  ? `${reviewStats.average.toFixed(1)} ★ · ${reviewStats.count}`
                  : '0'}
              </div>
            </div>
            {reviews.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center flex-1 flex items-center justify-center">
                {t('admin.noReviews')}
              </p>
            ) : (
              <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar flex-1">
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-sm py-1 border-b border-stone-50 last:border-0"
                  >
                    <span className="shrink-0 mt-0.5">
                      {r.rating === 1 ? (
                        <Frown className="w-3.5 h-3.5 text-red-500" strokeWidth={2} />
                      ) : r.rating === 2 ? (
                        <Smile className="w-3.5 h-3.5 text-amber-600" strokeWidth={2} />
                      ) : (
                        <Heart className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      {r.comment ? (
                        <p className="text-stone-800 leading-snug text-xs">{r.comment}</p>
                      ) : (
                        <p className="text-stone-400 italic text-[10px]">-</p>
                      )}
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(r.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM: Recent Orders */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400" />
              {t('admin.recentOrders')}
            </div>
            <div className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
              {filteredOrders.length}
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
            {(['all', 'preparing', 'ready', 'done'] as OrderFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setOrderFilter(f)}
                className={`shrink-0 px-3 py-1 text-[11px] font-medium rounded-lg capitalize transition ${
                  orderFilter === f
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {f === 'all' ? t('admin.all') : f === 'preparing' ? t('dash.preparing') : f === 'ready' ? t('dash.ready') : t('dash.pickedUp')}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <p className="text-xs text-stone-500 py-6 text-center">
              {t('admin.noOrders')}
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-1 custom-scrollbar">
              {filteredOrders.map((o) => (
                <div
                  key={o.id}
                  className="py-2.5 flex items-center justify-between text-sm border-b border-stone-100 last:border-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold tabular-nums text-stone-900">
                      #{o.order_number}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(o.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      o.status === 'ready'
                        ? 'bg-emerald-100 text-emerald-700'
                        : o.status === 'done'
                        ? 'bg-stone-100 text-stone-600'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {o.status === 'preparing' ? t('dash.preparing') : o.status === 'ready' ? t('dash.ready') : t('dash.pickedUp')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DANGER ZONE */}
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 space-y-3">
          <div className="text-sm font-semibold text-red-800">{t('admin.deleteCafe')}</div>
          <p className="text-xs text-red-700/80 leading-relaxed">
            {t('admin.deleteWarning')}
          </p>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-50 transition shadow-sm mt-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('admin.deleteCafe')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={toggleStatus}
        title={shop.status === 'active' ? t('admin.confirmDisable') : t('admin.confirmEnable')}
        description={shop.status === 'active' ? t('admin.confirmDisableDesc') : t('admin.confirmEnableDesc')}
        confirmLabel={shop.status === 'active' ? t('admin.disable') : t('admin.enable')}
        cancelLabel={t('admin.cancel')}
        variant={shop.status === 'active' ? 'danger' : 'default'}
        loading={busy}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={`${t('admin.deleteCafe')}?`}
        description={t('admin.deleteWarning')}
        confirmLabel={t('admin.delete')}
        cancelLabel={t('admin.cancel')}
        loading={busy}
      />

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useT()
  if (status === 'disabled') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-red-100 text-red-700 shadow-sm">
        <XCircle className="w-3.5 h-3.5" /> {t('admin.statusDisabled')}
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 shadow-sm">
        <Clock className="w-3.5 h-3.5" /> {t('admin.statusPending')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 shadow-sm">
      <CheckCircle2 className="w-3.5 h-3.5" /> {t('admin.statusActive')}
    </span>
  )
}