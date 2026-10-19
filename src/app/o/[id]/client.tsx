'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Coffee,
  Check,
  BellRing,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import CatchBeans from '@/components/CatchBeans'
import NotificationSetup from '@/components/NotificationSetup'
import Logo from '@/components/Logo'
import CupLogo from '@/components/CupLogo'
import CozyPattern from '@/components/CozyPattern'
import ReviewPrompt from '@/components/ReviewPrompt'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'
import { setBadge, clearBadge } from '@/lib/badge'
import { useElapsed, formatElapsed } from '@/hooks/useElapsed'
import {
  getFont,
  getPalette,
  paletteVars,
  type Shop,
} from '@/lib/themes'

type Order = {
  id: string
  shop_id: string
  order_number: string
  status: 'preparing' | 'ready' | 'done'
  customer_connected: boolean
  created_at: string
  ready_at: string | null
}

export default function CustomerOrderClient({ orderId }: { orderId: string }) {
  const t = useT()
  const [order, setOrder] = useState<Order | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ringing, setRinging] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------- load order + shop ----------
  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    // Check if this order was already acknowledged
    try {
      const ack = localStorage.getItem(`cup-ack-${orderId}`)
      if (ack === '1') {
        setAcknowledged(true)
        setRinging(false)
      }
    } catch {}

    async function load() {
      try {
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle()

        if (cancelled) return
        if (orderErr) {
          setError(orderErr.message)
          setLoading(false)
          return
        }
        if (!orderData) {
          setError('Order not found')
          setLoading(false)
          return
        }

        setOrder(orderData)
        setLoading(false)

        try {
          localStorage.setItem('cup-active-order', orderId)
        } catch {}

        supabase
          .from('shops')
          .select(
            'id, name, tagline, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages'
          )
          .eq('id', orderData.shop_id)
          .maybeSingle()
          .then(({ data }) => {
            if (!cancelled && data) setShop(data as Shop)
          })

        fetch(`/api/orders/${orderId}/connect`, { method: 'POST' }).catch(
          () => {}
        )

        // Only ring if it's ready AND not already acknowledged
        const ack = localStorage.getItem(`cup-ack-${orderId}`)
        if (orderData.status === 'ready' && ack !== '1') {
          setRinging(true)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load order')
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  // ---------- realtime ----------
  useEffect(() => {
    if (!orderId) return
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updated = payload.new as Order
          setOrder(updated)
          
          // Only ring if it became ready AND not acknowledged
          const ack = localStorage.getItem(`cup-ack-${orderId}`)
          if (updated.status === 'ready' && ack !== '1') {
            setRinging(true)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  // ---------- sound + vibration ----------
  useEffect(() => {
    if (!ringing || acknowledged) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      if (vibrateIntervalRef.current) {
        clearInterval(vibrateIntervalRef.current)
        vibrateIntervalRef.current = null
      }
      if (navigator.vibrate) navigator.vibrate(0)
      return
    }

    const audio = audioRef.current
    if (audio) {
      audio.loop = true
      audio.volume = 1
      audio.play().catch(() => {})
    }

    const buzz = () => {
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500])
    }
    buzz()
    vibrateIntervalRef.current = setInterval(buzz, 2000)

    const originalTitle = document.title
    let on = false
    const titleInterval = setInterval(() => {
      document.title = on ? 'Order Ready' : originalTitle
      on = !on
    }, 800)

    return () => {
      clearInterval(titleInterval)
      document.title = originalTitle
      if (vibrateIntervalRef.current) {
        clearInterval(vibrateIntervalRef.current)
        vibrateIntervalRef.current = null
      }
      if (navigator.vibrate) navigator.vibrate(0)
    }
  }, [ringing, acknowledged])

  // ---------- wake lock ----------
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null
    async function acquire() {
      try {
        const wl = (
          navigator as unknown as {
            wakeLock?: {
              request: (t: 'screen') => Promise<{
                release: () => Promise<void>
              }>
            }
          }
        ).wakeLock
        if (wl) sentinel = await wl.request('screen')
      } catch {}
    }
    acquire()
    function onVis() {
      if (document.visibilityState === 'visible' && !sentinel) acquire()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (sentinel) sentinel.release().catch(() => {})
    }
  }, [])

  const resumeAudio = useCallback(() => {
    if (ringing && audioRef.current) {
      audioRef.current.play().catch(() => {})
    }
  }, [ringing])

  useEffect(() => {
    document.addEventListener('click', resumeAudio, { once: true })
    document.addEventListener('touchstart', resumeAudio, { once: true })
    return () => {
      document.removeEventListener('click', resumeAudio)
      document.removeEventListener('touchstart', resumeAudio)
    }
  }, [resumeAudio])

  const palette = useMemo(
    () => getPalette(shop?.theme?.palette),
    [shop?.theme?.palette]
  )
  const font = useMemo(() => getFont(shop?.theme?.font), [shop?.theme?.font])

  const themeVars = useMemo(() => {
    const base = paletteVars(palette)
    if (shop?.theme?.primary) {
      ;(base as Record<string, string>)['--primary'] = shop.theme.primary
    }
    return base
  }, [palette, shop?.theme?.primary])

  useEffect(() => {
    if (typeof document === 'undefined' || !font) return
    const id = `font-${font.id}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${font.google}&display=swap`
    document.head.appendChild(link)
  }, [font])

  const bodyFont = font.body.includes('serif')
    ? 'ui-serif, Georgia, serif'
    : 'ui-sans-serif, system-ui, sans-serif'

  const preparingMsg = shop?.messages?.preparing || t('cust.preparing')
  const readyMsg = shop?.messages?.ready || t('cust.ready')

  useEffect(() => {
    if (!order) return
    if (acknowledged) {
      clearBadge()
      return
    }
    if (order.status === 'ready') {
      setBadge(1)
    } else if (order.status === 'preparing') {
      setBadge()
    }
  }, [order, acknowledged])

  useEffect(() => {
    if (!acknowledged) return
    clearBadge()
    try {
      localStorage.removeItem('cup-active-order')
    } catch {}
  }, [acknowledged])

  const elapsedLive = useElapsed(order?.created_at ?? null, null)
  const elapsedFinal = useElapsed(
    order?.created_at ?? null,
    order?.ready_at ?? null
  )

  function handleAcknowledge() {
    setAcknowledged(true)
    setRinging(false)
    try {
      // Save that this specific order was acknowledged so it persists on reload
      localStorage.setItem(`cup-ack-${orderId}`, '1')
    } catch {}
  }

  if (loading) {
    return (
      <main
        className="relative min-h-screen flex flex-col"
        style={{
          background: 'var(--bg, #faf7f2)',
          color: 'var(--text, #1c1917)',
          ...themeVars,
          fontFamily: bodyFont,
        }}
      >
        <div className="relative z-10 flex min-h-screen flex-col">
          <header
            className="border-b px-5 py-4"
            style={{
              borderColor: 'var(--border, #e7e5e4)',
              background: 'var(--surface, #fff)',
            }}
          >
            <div className="max-w-md mx-auto flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: 'var(--primary, #1c1917)',
                  color: 'var(--primary-text, #fafaf9)',
                }}
              >
                <Coffee className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div className="text-sm font-semibold">
                {t('common.loading')}
              </div>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="space-y-3 text-center">
              <Loader2
                className="w-6 h-6 animate-spin mx-auto"
                style={{ color: 'var(--primary, #b45309)' }}
              />
              <p
                className="text-xs"
                style={{ color: 'var(--text-muted, #78716c)' }}
              >
                {t('common.justAMoment')}
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#faf7f2] text-stone-900">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-semibold">
            {t('common.orderNotFound')}
          </h1>
          <p className="text-sm text-stone-500">
            {error || t('common.askBarista')}
          </p>
        </div>
      </main>
    )
  }

  const ready = order.status === 'ready'

  return (
    <main
      className="relative min-h-screen flex flex-col"
      style={{
        ...themeVars,
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: bodyFont,
      }}
    >
      {palette.pattern === 'beans' && (
        <CozyPattern color={palette.primary} opacity={0.05} />
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <audio ref={audioRef} preload="auto">
          <source src="/ready.mp3" type="audio/mpeg" />
        </audio>

        {/* HEADER */}
        <header
          className="border-b px-5 py-4"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Logo
                url={shop?.logo_url ?? null}
                name={shop?.name ?? 'Coffee'}
                size={34}
                scale={Number(shop?.logo_scale ?? 1)}
                offsetX={Number(shop?.logo_offset_x ?? 0)}
                offsetY={Number(shop?.logo_offset_y ?? 0)}
                radius={9}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {shop?.name ?? 'Coffee shop'}
                </div>
                {shop?.tagline && (
                  <div
                    className="text-[11px] truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {shop.tagline}
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <LanguageSwitcher compact />
            </div>
          </div>
        </header>

        <div className="flex-1">
          <div className="max-w-md mx-auto p-5 space-y-6">
            {/* ORDER NUMBER */}
            <div className="text-center space-y-2 pt-6">
              <div
                className="text-xs uppercase tracking-widest font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('cust.yourOrder')}
              </div>
              <div className="text-6xl font-bold tabular-nums break-all">
                #{order.order_number}
              </div>
            </div>

            {/* STATUS */}
            {acknowledged ? (
              <div className="space-y-4">
                <div className="text-center space-y-3 py-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: '#d1fae5' }}
                  >
                    <Check
                      className="w-10 h-10"
                      style={{ color: '#059669' }}
                      strokeWidth={2.5}
                    />
                  </div>
                  <p className="text-lg font-semibold">{t('cust.enjoy')}</p>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('cust.canClose')}
                  </p>
                </div>

                <ReviewPrompt orderId={orderId} />
              </div>
            ) : ready ? (
              <div className="space-y-5 py-4">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mx-auto animate-pulse"
                  style={{ background: '#d1fae5' }}
                >
                  <BellRing
                    className="w-12 h-12"
                    style={{ color: '#059669' }}
                  />
                </div>
                <div className="text-center space-y-1">
                  <h1
                    className="text-3xl font-bold"
                    style={{ color: '#047857' }}
                  >
                    {readyMsg}
                  </h1>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('cust.pickup')}
                  </p>
                  <p
                    className="text-xs inline-flex items-center gap-1.5 tabular-nums pt-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {t('cust.readyIn')}{' '}
                    <span
                      className="font-semibold"
                      style={{ color: 'var(--text)' }}
                    >
                      {formatElapsed(elapsedFinal)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleAcknowledge}
                  className="w-full py-4 rounded-2xl font-bold text-lg active:scale-[0.99] transition"
                  style={{
                    background: '#059669',
                    color: '#ffffff',
                  }}
                >
                  {t('cust.gotIt')}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center py-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'var(--accent-soft)' }}
                >
                  <Coffee
                    className="w-10 h-10"
                    style={{ color: 'var(--accent)' }}
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold">{preparingMsg}</h1>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('cust.willRing')}
                  </p>
                </div>

                {/* Progress */}
                <div className="pt-3 max-w-xs mx-auto">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span>{t('cust.received')}</span>
                    <span>{t('cust.preparingStep')}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t('cust.readyStep')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: 'var(--primary)' }}
                    />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: 'var(--primary)' }}
                    />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: 'var(--border)' }}
                    />
                  </div>
                </div>

                {/* Live elapsed timer */}
                <div
                  className="pt-4 flex items-center justify-center gap-1.5 text-xs tabular-nums"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('cust.waitingFor')}</span>
                  <span
                    className="font-semibold"
                    style={{ color: 'var(--text)' }}
                  >
                    {formatElapsed(elapsedLive)}
                  </span>
                </div>
              </div>
            )}

            {/* Notifications prompt */}
            {!acknowledged && <NotificationSetup orderId={orderId} />}

            {/* GAME */}
            {!acknowledged && shop?.game !== 'none' && (
              <div className="space-y-2">
                <div
                  className="text-xs uppercase tracking-wider font-semibold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t('cust.whileYouWait')}
                </div>
                <CatchBeans />
              </div>
            )}
          </div>
        </div>

        <footer
          className="px-5 py-5 text-center text-[11px] flex flex-col items-center gap-2"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>{t('cust.keepOpen')}</span>
          <span className="inline-flex items-center gap-1.5 opacity-70">
            <CupLogo size={12} />
            <span>{t('cust.poweredBy')}</span>
          </span>
        </footer>
      </div>
    </main>
  )
}