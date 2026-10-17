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
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

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
      const msg =
        next === 'active'
          ? 'Approved'
          : next === 'disabled'
          ? shop?.status === 'pending'
            ? 'Declined'
            : 'Access disabled'
          : 'Updated'
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

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </main>
    )
  }

  if (!shop) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
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
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <CupLogo size={24} />
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition px-2 py-1.5 rounded-lg hover:bg-stone-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Cafés
            </button>
          </div>

          <div className="text-sm font-semibold truncate max-w-[50%]">
            {shop.name}
          </div>

          <div className="min-w-[40px]" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* Identity */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-4">
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logo_url}
                alt=""
                className="w-14 h-14 rounded-xl object-cover border border-stone-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-stone-900 flex items-center justify-center text-amber-50 font-bold text-lg">
                {(shop.name || 'C')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold truncate">
                {shop.name}
              </div>
              <div className="text-xs text-stone-500 truncate">
                {shop.tagline || 'No tagline'}
              </div>
              <div className="mt-1">
                {shop.status === 'active' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : shop.status === 'pending' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3" /> Disabled
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Access */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
          <div className="text-sm font-semibold">Access</div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-stone-500">
              {shop.status === 'active'
                ? 'This café can log in and take orders.'
                : shop.status === 'pending'
                ? 'This café is waiting for your approval.'
                : 'This café cannot log in.'}
            </div>

            {shop.status === 'pending' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeStatus('disabled')}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                >
                  Decline
                </button>
                <button
                  onClick={() => changeStatus('active')}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-500 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
              </div>
            ) : (
              <button
                onClick={toggleStatus}
                disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  shop.status === 'active'
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {shop.status === 'active' ? 'Disable access' : 'Enable access'}
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-stone-100 space-y-2">
            <div className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Reset barista PIN
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
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition tracking-widest"
              />
              <button
                onClick={resetPin}
                disabled={busy || newPin.length < 4}
                className="px-4 py-2.5 rounded-lg bg-stone-900 text-amber-50 text-sm font-medium hover:bg-stone-800 disabled:opacity-40 transition"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Reviews</div>
            <div className="text-xs text-stone-500 tabular-nums">
              {reviewStats.count > 0
                ? `${reviewStats.average.toFixed(1)} ★ · ${reviewStats.count}`
                : 'No reviews yet'}
            </div>
          </div>
          {reviews.length === 0 ? (
            <p className="text-xs text-stone-500 py-6 text-center">
              No reviews yet
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {reviews.slice(0, 10).map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-sm py-2 border-b border-stone-100 last:border-0"
                >
                  <span className="text-lg shrink-0">
                    {r.rating === 1 ? '😐' : r.rating === 2 ? '🙂' : '🤩'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {r.comment ? (
                      <p className="text-stone-700">{r.comment}</p>
                    ) : (
                      <p className="text-stone-400 italic text-xs">
                        No comment
                      </p>
                    )}
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Recent orders</div>
            <div className="text-xs text-stone-500 tabular-nums">
              {orders.length}
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-stone-500 py-6 text-center">
              No orders yet
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {orders.slice(0, 20).map((o) => (
                <div
                  key={o.id}
                  className="py-2.5 flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums w-12">
                      #{o.order_number}
                    </span>
                    <span className="text-xs text-stone-500">
                      {new Date(o.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
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

        {/* Danger */}
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 space-y-3">
          <div className="text-sm font-semibold text-red-800">Danger zone</div>
          <p className="text-xs text-red-700/80">
            Deleting removes the café and all its orders. Cannot be undone.
          </p>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete café
          </button>
        </div>
      </div>

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