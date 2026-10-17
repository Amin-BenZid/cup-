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
          <p className="text-sm text-stone-600">{error || 'Café not found'}</p>
          <button
            onClick={() => router.push('/admin')}
            className="text-sm underline text-stone-600"
          >
            Back to list
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
            <ArrowLeft className="w-4 h-4" />
            Cafés
          </button>
          <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center shadow-sm">
            <CupLogo size={18} />
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* TOP SECTION: Identity + Management (Side by side on desktop) */}
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
                {shop.tagline || 'No tagline'}
              </p>
            </div>
          </div>

          {/* MANAGEMENT CARD (Access + PIN) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold border-b border-stone-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-stone-400" />
              Management
            </div>

            {/* Access Control Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-stone-600 font-medium">
                {shop.status === 'active'
                  ? 'Café can log in and take orders.'
                  : shop.status === 'pending'
                  ? 'Waiting for your approval.'
                  : 'Access is currently blocked.'}
              </div>

              {shop.status === 'pending' ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => changeStatus('disabled')}
                    disabled={busy}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 bg-white border border-stone-200 text-red-600 hover:bg-red-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => changeStatus('active')}
                    disabled={busy}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmStatus(true)}
                  disabled={busy}
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow-sm ${
                    shop.status === 'active'
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {shop.status === 'active' ? 'Disable access' : 'Enable access'}
                </button>
              )}
            </div>

            {/* Reset PIN Row */}
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <div className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Reset Barista PIN
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="4–6 digits"
                  className="flex-1 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-xs outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition tracking-widest font-mono"
                />
                <button
                  onClick={resetPin}
                  disabled={busy || newPin.length < 4}
                  className="px-3 py-2 rounded-lg bg-stone-900 text-amber-50 text-xs font-semibold hover:bg-stone-800 disabled:opacity-40 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: Activity & Reviews (Side by side on desktop) */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* ACTIVITY HISTORY */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-stone-400" />
                Activity History
              </div>
              <div className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
                {history.length}
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center flex-1 flex items-center justify-center">
                No activity logged yet
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

          {/* REVIEWS */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Heart className="w-4 h-4 text-stone-400" />
                Reviews
              </div>
              <div className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
                {reviewStats.count > 0
                  ? `${reviewStats.average.toFixed(1)} ★ · ${reviewStats.count}`
                  : '0'}
              </div>
            </div>
            {reviews.length === 0 ? (
              <p className="text-xs text-stone-500 py-6 text-center flex-1 flex items-center justify-center">
                No reviews yet
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
                        <p className="text-stone-400 italic text-[10px]">No comment</p>
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

        {/* BOTTOM SECTION: Recent Orders (Full width) */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400" />
              Recent Orders
            </div>
            <div className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
              {filteredOrders.length}
            </div>
          </div>

          {/* Filter Pills */}
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
                {f}
              </button>
            ))}
          </div>

          {/* Scrollable Window */}
          {filteredOrders.length === 0 ? (
            <p className="text-xs text-stone-500 py-6 text-center">
              No {orderFilter !== 'all' ? orderFilter : ''} orders found
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
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DANGER ZONE */}
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 space-y-3">
          <div className="text-sm font-semibold text-red-800">Danger zone</div>
          <p className="text-xs text-red-700/80 leading-relaxed">
            Deleting removes the café and all its orders from the platform. This action cannot be undone.
          </p>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-50 transition shadow-sm mt-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete café
          </button>
        </div>
      </div>

      {/* CONFIRM: Enable / Disable */}
      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={toggleStatus}
        title={shop.status === 'active' ? 'Disable this café?' : 'Enable this café?'}
        description={
          shop.status === 'active'
            ? 'Baristas will not be able to log in and take orders until re-enabled.'
            : 'This café will be able to log in and take orders again.'
        }
        confirmLabel={shop.status === 'active' ? 'Disable access' : 'Enable access'}
        variant={shop.status === 'active' ? 'danger' : 'default'}
        loading={busy}
      />

      {/* CONFIRM: Delete */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={`Delete ${shop.name}?`}
        description="This removes the café and all of its orders. This action cannot be undone."
        confirmLabel="Delete café"
        loading={busy}
      />

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'disabled') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-red-100 text-red-700 shadow-sm">
        <XCircle className="w-3.5 h-3.5" /> Disabled
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 shadow-sm">
        <Clock className="w-3.5 h-3.5" /> Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 shadow-sm">
      <CheckCircle2 className="w-3.5 h-3.5" /> Active
    </span>
  )
}