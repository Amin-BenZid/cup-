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
  History as HistoryIcon,
  CreditCard,
  ShieldCheck,
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
  trial_ends_at?: string | null
  subscription_ends_at?: string | null
  billing_status?: string | null
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
  const [billingBusy, setBillingBusy] = useState(false)
  const [error, setError] = useState('')
  const [newPin, setNewPin] = useState('')
  
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(false)
  const [confirmBilling, setConfirmBilling] = useState<{ months: number } | null>(null)
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
        push('success', `Extended by ${months} month(s)`)
        await load()
      } else {
        const json = await res.json()
        push('error', json.error ?? 'Failed to extend')
      }
    } finally {
      setBillingBusy(false)
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

  // ADDED: Calculate the time remaining for billing
  function getTimeRemaining(dateString?: string | null) {
    if (!dateString) return { text: '—', color: 'text-zinc-400' }
    const now = new Date()
    const end = new Date(dateString)
    const diffMs = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { text: `Expired ${Math.abs(diffDays)}d ago`, color: 'text-red-600 font-medium' }
    if (diffDays === 0) return { text: 'Ends today', color: 'text-amber-600 font-medium' }
    if (diffDays <= 7) return { text: `Ends in ${diffDays} days`, color: 'text-amber-600 font-medium' }
    if (diffDays <= 30) return { text: `Ends in ${diffDays} days`, color: 'text-zinc-600' }
    
    const diffMonths = Math.floor(diffDays / 30)
    return { text: `Ends in ${diffMonths} month${diffMonths > 1 ? 's' : ''}`, color: 'text-zinc-500' }
  }

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'all') return true
    return o.status === orderFilter
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </main>
    )
  }

  if (!shop) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm text-zinc-600">{error || 'Shop not found'}</p>
          <button onClick={() => router.push('/admin')} className="text-sm underline text-zinc-600">
            {t('common.back')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition -ms-2 p-2 rounded-md hover:bg-zinc-100"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            Back
          </button>
          <LanguageSwitcher compact />
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8 pb-24">
        
        {/* IDENTITY + STATUS */}
        <section className="flex items-start gap-5">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-zinc-200" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-100 font-semibold text-xl">
              {shop.name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold leading-tight truncate">{shop.name}</h1>
              <StatusBadge status={shop.status} />
            </div>
            <p className="text-sm text-zinc-500 mt-1">{shop.tagline || 'No tagline'}</p>
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* GRID: MANAGEMENT + BILLING */}
        <section className="grid md:grid-cols-2 gap-4">
          
          {/* MANAGEMENT */}
          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold">Management</h2>
            </div>
            <div className="p-4 space-y-5">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">Access</div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500 flex-1">
                    {shop.status === 'active' ? 'Shop can log in and take orders.' : shop.status === 'pending' ? 'Waiting for approval.' : 'Access is blocked.'}
                  </p>
                  {shop.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeStatus('active')} disabled={busy} className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 transition">Approve</button>
                      <button onClick={() => changeStatus('disabled')} disabled={busy} className="px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition">Decline</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmStatus(true)} disabled={busy} className={`px-3 py-1.5 rounded-md text-xs font-medium transition disabled:opacity-50 ${shop.status === 'active' ? 'border border-zinc-200 text-red-600 hover:bg-red-50' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
                      {shop.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" /> Reset PIN
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text" inputMode="numeric" value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="4–6 digits"
                    className="flex-1 px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-xs outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition tracking-widest font-mono"
                  />
                  <button onClick={resetPin} disabled={busy || newPin.length < 4} className="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-40 transition">Save</button>
                </div>
              </div>
            </div>
          </div>

          {/* BILLING */}
          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold">Billing</h2>
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${shop.billing_status === 'active' ? 'bg-emerald-100 text-emerald-700' : shop.billing_status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                {shop.billing_status || 'trial'}
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Trial ends</div>
                  <div className="text-zinc-900 font-medium">
                    {shop.trial_ends_at ? new Date(shop.trial_ends_at).toLocaleDateString() : '—'}
                  </div>
                  <div className={`text-[10px] ${getTimeRemaining(shop.trial_ends_at).color}`}>
                    {getTimeRemaining(shop.trial_ends_at).text}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-0.5">Sub ends</div>
                  <div className="text-zinc-900 font-medium">
                    {shop.subscription_ends_at ? new Date(shop.subscription_ends_at).toLocaleDateString() : '—'}
                  </div>
                  <div className={`text-[10px] ${getTimeRemaining(shop.subscription_ends_at).color}`}>
                    {getTimeRemaining(shop.subscription_ends_at).text}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">Extend</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map((m) => (
                    <button key={m} onClick={() => setConfirmBilling({ months: m })} disabled={billingBusy} className="px-2 py-1.5 rounded-md border border-zinc-200 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 transition">
                      +{m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HISTORY + REVIEWS */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold">Activity</h2>
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">{history.length}</span>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No activity yet.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-2">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-zinc-50">
                    <div className="shrink-0 mt-0.5">
                      {h.action === 'created' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                      {h.action === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {h.action === 'disabled' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      {h.action === 'pin_reset' && <KeyRound className="w-3.5 h-3.5 text-amber-500" />}
                      {h.action === 'billing_extended' && <CreditCard className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-900 capitalize">{h.action.replace(/_/g, ' ')}</div>
                      <div className="text-[10px] text-zinc-500 tabular-nums">
                        {new Date(h.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold">Reviews</h2>
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {reviewStats.count > 0 ? `${reviewStats.average.toFixed(1)} ★ · ${reviewStats.count}` : '—'}
              </span>
            </div>
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">No reviews yet.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-2">
                {reviews.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-zinc-50">
                    <div className="shrink-0 mt-0.5">
                      {r.rating === 1 ? <Frown className="w-3.5 h-3.5 text-red-500" strokeWidth={2} /> : r.rating === 2 ? <Smile className="w-3.5 h-3.5 text-amber-600" strokeWidth={2} /> : <Heart className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-900">{r.comment || <span className="text-zinc-400 italic">No comment</span>}</div>
                      <div className="text-[10px] text-zinc-500 tabular-nums">
                        {new Date(r.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RECENT ORDERS */}
        <section className="bg-white border border-zinc-200 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold">Recent orders</h2>
            </div>
            <span className="text-[11px] text-zinc-500 tabular-nums">{filteredOrders.length}</span>
          </div>

          <div className="px-4 py-2 border-b border-zinc-100 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['all', 'preparing', 'ready', 'done'] as OrderFilter[]).map((f) => (
              <button key={f} onClick={() => setOrderFilter(f)} className={`shrink-0 px-3 py-1 rounded-md text-[11px] font-medium capitalize transition border ${orderFilter === f ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                {f}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">No orders match this filter.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
              {filteredOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-zinc-900 tabular-nums w-14">#{o.order_number}</span>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {new Date(o.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* DANGER ZONE */}
        <section className="bg-white border border-red-200 rounded-lg">
          <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-zinc-500">Deleting removes this shop and all its orders. Cannot be undone.</p>
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition">
              <Trash2 className="w-3.5 h-3.5" /> Delete shop
            </button>
          </div>
        </section>
      </div>

      {/* DIALOGS */}
      <ConfirmDialog open={!!confirmBilling} onClose={() => setConfirmBilling(null)} onConfirm={executeBilling} title={`Extend by ${confirmBilling?.months} month(s)?`} description="This adds to the current subscription end date." confirmLabel="Confirm" cancelLabel="Cancel" variant="default" loading={billingBusy} />
      <ConfirmDialog open={confirmStatus} onClose={() => setConfirmStatus(false)} onConfirm={toggleStatus} title={shop.status === 'active' ? 'Disable this shop?' : 'Enable this shop?'} description={shop.status === 'active' ? 'Staff will not be able to log in.' : 'Staff will be able to log in again.'} confirmLabel={shop.status === 'active' ? 'Disable' : 'Enable'} cancelLabel="Cancel" variant={shop.status === 'active' ? 'danger' : 'default'} loading={busy} />
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={doDelete} title={`Delete ${shop.name}?`} description="This removes the shop and all its orders. Cannot be undone." confirmLabel="Delete" cancelLabel="Cancel" loading={busy} />

      <Toast toasts={toasts} onDismiss={dismiss} />
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const base = 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded'
  if (status === 'disabled') return <span className={`${base} bg-red-100 text-red-700`}><XCircle className="w-3 h-3" /> Disabled</span>
  if (status === 'pending') return <span className={`${base} bg-amber-100 text-amber-800`}><Clock className="w-3 h-3" /> Pending</span>
  return <span className={`${base} bg-emerald-100 text-emerald-700`}><CheckCircle2 className="w-3 h-3" /> Active</span>
}

function OrderStatusBadge({ status }: { status: string }) {
  const base = 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded'
  if (status === 'ready') return <span className={`${base} bg-emerald-100 text-emerald-700`}>Ready</span>
  if (status === 'done') return <span className={`${base} bg-zinc-100 text-zinc-600`}>Done</span>
  return <span className={`${base} bg-amber-100 text-amber-800`}>Preparing</span>
}