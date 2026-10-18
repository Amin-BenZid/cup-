'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Loader2,
  Activity,
  CheckCircle2,
  Clock,
  Package,
  Store,
  Search,
  X,
} from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type LiveOrder = {
  id: string
  order_number: string
  status: string
  created_at: string
  ready_at: string | null
  shop_id: string
  shops: {
    name: string
    logo_url: string | null
  } | null
}

export default function LiveFeedPage() {
  const t = useT()
  const router = useRouter()
  const [orders, setOrders] = useState<LiveOrder[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtering state
  const [search, setSearch] = useState('')
  const [selectedShop, setSelectedShop] = useState<string | 'all'>('all')
  const [shopMenuOpen, setShopMenuOpen] = useState(false)

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/live', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/admin/login')
        return
      }
      const json = await res.json()
      if (res.ok) {
        setOrders(json.orders)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadOrders()

    const channel = supabase
      .channel('admin-live-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadOrders])

  // Extract unique shops for the filter menu
  const uniqueShops = useMemo(() => {
    const map = new Map<string, string>()
    orders.forEach((o) => {
      if (o.shop_id && o.shops?.name) {
        map.set(o.shop_id, o.shops.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [orders])

  // Apply filters
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedShop !== 'all' && o.shop_id !== selectedShop) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const shopName = o.shops?.name?.toLowerCase() ?? ''
        const orderNum = o.order_number.toLowerCase()
        if (!shopName.includes(q) && !orderNum.includes(q)) return false
      }
      return true
    })
  }, [orders, selectedShop, search])

  function timeSince(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m`
    return `${Math.floor(m / 60)}h`
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition -ms-2 p-2 rounded-lg hover:bg-stone-200/50 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('common.back')}
          </button>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold text-stone-900">{t('live.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <div className="w-8 h-8 rounded-[10px] bg-stone-900 flex items-center justify-center shadow-sm">
              <CupLogo size={18} />
            </div>
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      <div className="sticky top-[57px] z-10 bg-stone-50 border-b border-stone-200/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('live.searchPlaceholder')}
              className="w-full ps-9 pe-8 py-2 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Shop Filter Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShopMenuOpen((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition ${
                selectedShop !== 'all'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Store className="w-4 h-4" />
              <span className="max-w-[100px] truncate">
                {selectedShop === 'all'
                  ? t('live.allShops')
                  : uniqueShops.find((s) => s.id === selectedShop)?.name || 'Shop'}
              </span>
            </button>

            {shopMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShopMenuOpen(false)}
                />
                <div className="absolute end-0 top-full mt-2 w-56 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-40 max-h-64 overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => {
                      setSelectedShop('all')
                      setShopMenuOpen(false)
                    }}
                    className={`w-full text-start px-4 py-2.5 text-sm hover:bg-stone-50 transition ${
                      selectedShop === 'all' ? 'font-semibold text-stone-900 bg-stone-50/50' : 'text-stone-600'
                    }`}
                  >
                    {t('live.allShops')}
                  </button>
                  {uniqueShops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => {
                        setSelectedShop(shop.id)
                        setShopMenuOpen(false)
                      }}
                      className={`w-full text-start px-4 py-2.5 text-sm hover:bg-stone-50 transition truncate ${
                        selectedShop === shop.id ? 'font-semibold text-stone-900 bg-stone-50/50' : 'text-stone-600'
                      }`}
                    >
                      {shop.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-stone-300 rounded-2xl bg-white">
            <Activity className="w-10 h-10 text-stone-300 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-stone-900">
              {orders.length === 0 ? t('live.noOrders') : t('live.noResults')}
            </h3>
            <p className="text-sm text-stone-500 mt-1 max-w-xs mx-auto">
              {orders.length === 0 
                ? t('live.waiting')
                : t('live.adjustFilters')}
            </p>
            {(search || selectedShop !== 'all') && (
              <button
                onClick={() => {
                  setSearch('')
                  setSelectedShop('all')
                }}
                className="mt-4 px-4 py-2 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 transition"
              >
                {t('live.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`rounded-2xl border p-4 bg-white shadow-sm transition-all duration-500 ${
                  order.status === 'ready'
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : order.status === 'done'
                    ? 'border-stone-200 opacity-60'
                    : 'border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {order.shops?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.shops.logo_url}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover border border-stone-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-amber-50 font-bold shrink-0">
                        {(order.shops?.name || 'C')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link 
                        href={`/admin/shops/${order.shop_id}`}
                        className="text-sm font-semibold truncate hover:underline block text-start"
                      >
                        {order.shops?.name || 'Shop'}
                      </Link>
                      <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2">
                        <span className="font-bold text-stone-900">#{order.order_number}</span>
                        <span>•</span>
                        <span>{timeSince(order.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {order.status === 'preparing' && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 shadow-sm">
                        <Clock className="w-3.5 h-3.5" /> {t('dash.preparing')}
                      </span>
                    )}
                    {order.status === 'ready' && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('dash.ready')}
                      </span>
                    )}
                    {order.status === 'done' && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 shadow-sm">
                        <Package className="w-3.5 h-3.5" /> {t('dash.pickedUp')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}