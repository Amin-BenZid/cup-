'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  Plus,
  LogOut,
  QrCode,
  Check,
  Package,
  X,
  AlertCircle,
  Settings,
} from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type Order = {
  id: string
  shop_id: string
  order_number: string
  status: 'preparing' | 'ready' | 'done'
  customer_connected: boolean
  created_at: string
  ready_at: string | null
}

type ShopInfo = {
  id: string
  name: string
  tagline?: string | null
  logo_url?: string | null
}

const DEV_LAN_IP = '192.168.0.228'

export default function DashboardPage() {
  const t = useT()
  const router = useRouter()

  const [shopId, setShopId] = useState<string | null>(null)
  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [creating, setCreating] = useState(false)
  const [qrOrder, setQrOrder] = useState<Order | null>(null)

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  // auth check + shop hydration
  useEffect(() => {
    const id = localStorage.getItem('shop_id')
    if (!id) {
      router.replace('/barista')
      return
    }
    setShopId(id)

    // Optimistic — show whatever's cached immediately
    const cachedName = localStorage.getItem('shop_name')
    if (cachedName) {
      setShop({ id, name: cachedName })
    }

    // Then fetch fresh — the shop may have been renamed in customize
    ;(async () => {
      try {
        const res = await fetch(`/api/shops/${id}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json.shop) {
          setShop({
            id: json.shop.id,
            name: json.shop.name,
            tagline: json.shop.tagline,
            logo_url: json.shop.logo_url,
          })
          // keep localStorage fresh
          localStorage.setItem('shop_name', json.shop.name)
        }
      } catch {
        // silent — we already showed the cached name
      }
    })()
  }, [router])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const loadOrders = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/orders/list?shop_id=${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const json = await res.json()
      setOrders(json.orders ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (!shopId) return
    loadOrders(shopId)
    const interval = setInterval(() => loadOrders(shopId), 4000)
    return () => clearInterval(interval)
  }, [shopId, loadOrders])

  async function createOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!shopId) return
    const num = orderNumber.trim()
    if (!num) return setToast(t('order.error.required'))

    setCreating(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId, order_number: num }),
      })
      const json = await res.json()
      if (!res.ok) return setToast(json.error ?? 'Failed')

      setNewOrderOpen(false)
      setOrderNumber('')
      setQrOrder(json.order)
      await loadOrders(shopId)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Network error')
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(order: Order, status: Order['status']) {
    if (!shopId) return
    if (busyIds.has(order.id)) return
    setBusyIds((prev) => new Set(prev).add(order.id))

    const before = orders
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status } : o))
    )

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOrders(before)
        setToast(json.error ?? `Failed (${res.status})`)
      } else {
        await loadOrders(shopId)
      }
    } catch (e) {
      setOrders(before)
      setToast(e instanceof Error ? e.message : 'Network error')
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev)
        n.delete(order.id)
        return n
      })
    }
  }

  function logout() {
    localStorage.removeItem('shop_id')
    localStorage.removeItem('shop_name')
    router.replace('/barista')
  }

  function customerUrl(orderId: string) {
    if (typeof window === 'undefined') return ''
    const { hostname, port, protocol } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${DEV_LAN_IP}:${port || '3000'}/o/${orderId}`
    }
    return `${protocol}//${hostname}${port ? ':' + port : ''}/o/${orderId}`
  }

  function timeAgo(iso: string) {
    const now = Date.now()
    const then = new Date(iso).getTime()
    if (!Number.isFinite(then)) return ''

    const seconds = Math.max(0, Math.floor((now - then) / 1000))
    if (seconds < 60) return t('dash.ago.s', { d: seconds })

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t('dash.ago.m', { d: minutes })

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('dash.ago.h', { d: hours })

    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  if (!shopId) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#faf7f2]">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-700 rounded-full animate-spin" />
      </main>
    )
  }

  const active = orders.filter((o) => o.status !== 'done')

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900">
      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#faf7f2]/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          {/* Left: logo + shop identity */}
          <div className="flex items-center gap-3 min-w-0">
            {shop?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="w-10 h-10 rounded-xl object-cover border border-stone-200 shrink-0"
              />
            ) : (
              <CupLogo size={40} />
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold leading-none mb-1">
                {t('dash.role')}
              </div>
              <div className="text-base font-semibold leading-tight truncate text-stone-900">
                {shop?.name || '…'}
              </div>
              {shop?.tagline && (
                <div className="text-[11px] text-stone-500 truncate leading-tight">
                  {shop.tagline}
                </div>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            <LanguageSwitcher compact />
            <button
              onClick={() => router.push('/barista/customize')}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition px-3 py-2 rounded-lg hover:bg-stone-100"
              title={t('dash.customize')}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('dash.customize')}</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition px-3 py-2 rounded-lg hover:bg-stone-100"
              title={t('dash.logout')}
            >
              <LogOut className="w-4 h-4 rtl:rotate-180" />
              <span className="hidden sm:inline">{t('dash.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
        <button
          onClick={() => setNewOrderOpen(true)}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-stone-900 text-amber-50 font-semibold text-lg hover:bg-stone-800 active:scale-[0.99] transition shadow-sm"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
          {t('dash.newOrder')}
        </button>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
              {t('dash.activeOrders')}
            </h2>
            <span className="text-xs text-stone-500 font-medium tabular-nums">
              {active.length}
            </span>
          </div>

          {active.length === 0 && (
            <div className="text-center py-16 border border-dashed border-stone-300 rounded-2xl bg-white/50">
              <QrCode className="w-8 h-8 text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-500">{t('dash.noOrders')}</p>
              <p className="text-xs text-stone-400 mt-1">
                {t('dash.noOrdersHint')}
              </p>
            </div>
          )}

          {active.map((order) => {
            const ready = order.status === 'ready'
            const busy = busyIds.has(order.id)
            return (
              <div
                key={order.id}
                className={`rounded-2xl border p-4 bg-white shadow-sm transition ${
                  ready
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold tabular-nums text-stone-900">
                        #{order.order_number}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          ready
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ready ? t('dash.ready') : t('dash.preparing')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500">
                      <span>{timeAgo(order.created_at)}</span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            order.customer_connected
                              ? 'bg-emerald-500'
                              : 'bg-stone-300'
                          }`}
                        />
                        {order.customer_connected
                          ? t('dash.customerConnected')
                          : t('dash.notScanned')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setQrOrder(order)}
                      title="QR"
                      className="w-10 h-10 rounded-xl border border-stone-200 hover:bg-stone-50 flex items-center justify-center transition"
                    >
                      <QrCode className="w-4 h-4 text-stone-500" />
                    </button>

                    {ready ? (
                      <button
                        onClick={() => updateStatus(order, 'done')}
                        disabled={busy}
                        className="h-10 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-sm font-medium flex items-center gap-2 transition disabled:opacity-50"
                      >
                        <Package className="w-4 h-4" />
                        {t('dash.pickedUp')}
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(order, 'ready')}
                        disabled={busy}
                        className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" strokeWidth={2.5} />
                        {busy ? t('dash.saving') : t('dash.markReady')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* New order modal */}
      {newOrderOpen && (
        <Modal onClose={() => setNewOrderOpen(false)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{t('order.title')}</h2>
                <p className="text-sm text-stone-500">
                  {t('order.subtitle')}
                </p>
              </div>
              <button
                onClick={() => setNewOrderOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            <form onSubmit={createOrder} className="space-y-4">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder={t('order.placeholder')}
                className="w-full px-4 py-4 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-3xl text-center font-bold tabular-nums"
              />

              <button
                type="submit"
                disabled={creating || !orderNumber.trim()}
                className="w-full py-3.5 rounded-xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 disabled:opacity-40 transition"
              >
                {creating ? t('order.creating') : t('order.create')}
              </button>
            </form>
          </div>
        </Modal>
      )}

      {/* QR modal */}
      {qrOrder && (
        <Modal onClose={() => setQrOrder(null)}>
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                  {t('qr.title')}
                </div>
                <div className="text-xl font-bold tabular-nums">
                  #{qrOrder.order_number}
                </div>
              </div>
              <button
                onClick={() => setQrOrder(null)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            <div className="text-center text-sm text-stone-500">
              {t('qr.subtitle')}
            </div>

            <div className="bg-white border border-stone-200 p-5 rounded-2xl flex items-center justify-center">
              <QRCodeSVG
                value={customerUrl(qrOrder.id)}
                size={220}
                level="M"
              />
            </div>

            <p className="text-[11px] text-stone-400 break-all text-center font-mono">
              {customerUrl(qrOrder.id)}
            </p>

            <button
              onClick={() => setQrOrder(null)}
              className="w-full py-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 font-semibold transition"
            >
              {t('qr.close')}
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[calc(100%-2rem)]">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl shadow-lg">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{toast}</p>
          </div>
        </div>
      )}
    </main>
  )
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-stone-200 rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}