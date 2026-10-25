'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  RotateCcw,
  Gamepad2,
  Palette as PaletteIcon,
  Image as ImageIcon,
  MessageSquare,
  Loader2,
  Smartphone,
  Monitor,
  Coffee,
  AlertCircle,
} from 'lucide-react'
import {
  FONTS,
  PALETTES,
  type FontId,
  type PaletteId,
  type Shop,
  type ShopMessages,
  type ShopTheme,
  DEFAULT_THEME,
  getPalette,
  getFont,
} from '@/lib/themes'
import LogoUploader from '@/components/LogoUploader'
import LogoAdjuster from '@/components/LogoAdjuster'
import Logo from '@/components/Logo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useT } from '@/lib/i18n/context'

type TabId = 'branding' | 'theme' | 'game' | 'messages'
type DeviceId = 'phone' | 'desktop'

// jsonb comes back with its keys reordered, and dropped undefined values never
// reach the database, so compare key-order-insensitively and skip undefined.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

function sameJson(a: unknown, b: unknown) {
  return stableJson(a) === stableJson(b)
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition'

function CustomizeContent() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [shopId, setShopId] = useState<string | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  
  const initialTab = (searchParams.get('tab') as TabId) || 'branding'
  const [tab, setTab] = useState<TabId>(
    ['branding', 'theme', 'game', 'messages'].includes(initialTab) ? initialTab : 'branding'
  )

  const [device, setDevice] = useState<DeviceId>('phone')

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoScale, setLogoScale] = useState(1)
  const [logoOffsetX, setLogoOffsetX] = useState(0)
  const [logoOffsetY, setLogoOffsetY] = useState(0)
  const [theme, setTheme] = useState<ShopTheme>(DEFAULT_THEME)
  const [game, setGame] = useState<string>('catch-beans')
  const [messages, setMessages] = useState<ShopMessages>({})

  useEffect(() => {
    const id = localStorage.getItem('shop_id')
    if (!id) {
      router.replace('/barista')
      return
    }
    setShopId(id)

    ;(async () => {
      const res = await fetch(`/api/shops/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load shop')
        setLoading(false)
        return
      }
      const s: Shop = json.shop
      setShop(s)
      setName(s.name ?? '')
      setTagline(s.tagline ?? '')
      setLogoUrl(s.logo_url ?? null)
      setLogoScale(Number(s.logo_scale ?? 1))
      setLogoOffsetX(Number(s.logo_offset_x ?? 0))
      setLogoOffsetY(Number(s.logo_offset_y ?? 0))
      setTheme(s.theme ?? DEFAULT_THEME)
      setGame(s.game ?? 'catch-beans')
      setMessages(s.messages ?? {})
      setLoading(false)
    })()
  }, [router])

  const save = useCallback(
    async (partial: Record<string, unknown>) => {
      if (!shopId) return
      setSaving(true)
      setError('')
      try {
        const res = await fetch(`/api/shops/${shopId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Save failed')
          return
        }
        setShop(json.shop)
        setSavedAt(Date.now())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
      } finally {
        setSaving(false)
      }
    },
    [shopId]
  )

  useEffect(() => {
    if (loading || !shopId) return
    const timer = setTimeout(() => {
      const payload: Record<string, unknown> = {}
      if (name !== (shop?.name ?? '')) payload.name = name
      if (tagline !== (shop?.tagline ?? '')) payload.tagline = tagline
      
      // Compare with what was last saved, not with the default — otherwise a
      // reset to the default is never persisted.
      if (!sameJson(theme, shop?.theme ?? DEFAULT_THEME)) payload.theme = theme

      if (game !== (shop?.game ?? 'catch-beans')) payload.game = game
      if (!sameJson(messages, shop?.messages ?? {}))
        payload.messages = messages
      if (logoScale !== Number(shop?.logo_scale ?? 1))
        payload.logo_scale = logoScale
      if (logoOffsetX !== Number(shop?.logo_offset_x ?? 0))
        payload.logo_offset_x = logoOffsetX
      if (logoOffsetY !== Number(shop?.logo_offset_y ?? 0))
        payload.logo_offset_y = logoOffsetY

      if (Object.keys(payload).length) save(payload)
    }, 900)
    return () => clearTimeout(timer)
  }, [
    name,
    tagline,
    theme,
    game,
    messages,
    logoScale,
    logoOffsetX,
    logoOffsetY,
    shop,
    loading,
    shopId,
    save,
  ])

  function resetTheme() {
    setTheme(DEFAULT_THEME)
    setGame('catch-beans')
    setMessages({})
  }

  const palette = useMemo(() => getPalette(theme.palette), [theme.palette])
  const font = useMemo(() => getFont(theme.font), [theme.font])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#faf7f2]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#faf7f2]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push('/barista/dashboard')}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 transition px-2 py-2 rounded-lg hover:bg-stone-100 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span className="hidden sm:inline">{t('common.back')}</span>
          </button>

          <div className="text-sm font-semibold">{t('cz.title')}</div>

          <div className="flex items-center gap-2 text-xs min-w-[80px] justify-end">
            <LanguageSwitcher compact />
            {saving ? (
              <span className="flex items-center gap-1.5 text-stone-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">{t('cz.saving')}</span>
              </span>
            ) : savedAt ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('cz.saved')}</span>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* LEFT */}
          <div className="space-y-5 min-w-0">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 border border-stone-200 overflow-x-auto">
              {(
                [
                  ['branding', t('cz.tab.branding'), ImageIcon],
                  ['theme', t('cz.tab.theme'), PaletteIcon],
                  ['game', t('cz.tab.game'), Gamepad2],
                  ['messages', t('cz.tab.messages'), MessageSquare],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg transition whitespace-nowrap ${
                    tab === id
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-7">
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {tab === 'branding' && (
                <>
                  <Field
                    label={t('cz.branding.shopName')}
                    hint={t('cz.branding.shopNameHint')}
                  >
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={INPUT_CLASS}
                      maxLength={40}
                    />
                  </Field>

                  <Field
                    label={t('cz.branding.tagline')}
                    hint={t('cz.branding.taglineHint')}
                  >
                    <input
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder={t('cz.branding.taglinePlaceholder')}
                      className={INPUT_CLASS}
                      maxLength={60}
                    />
                  </Field>

                  <Field
                    label={t('cz.branding.logo')}
                    hint={t('cz.branding.logoHint')}
                  >
                    <LogoUploader
                      currentUrl={logoUrl}
                      shopId={shopId!}
                      onUploaded={(url) => {
                        setLogoUrl(url)
                        setLogoScale(1)
                        setLogoOffsetX(0)
                        setLogoOffsetY(0)
                        setSavedAt(Date.now())
                      }}
                    />

                    {logoUrl && (
                      <>
                        <div className="mt-5 pt-5 border-t border-stone-100">
                          <div className="text-xs font-medium text-stone-700 mb-3">
                            {t('cz.branding.adjust')}
                          </div>
                          <LogoAdjuster
                            url={logoUrl}
                            name={name}
                            scale={logoScale}
                            offsetX={logoOffsetX}
                            offsetY={logoOffsetY}
                            onChange={({ scale, offsetX, offsetY }) => {
                              setLogoScale(scale)
                              setLogoOffsetX(offsetX)
                              setLogoOffsetY(offsetY)
                            }}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            await save({
                              logo_url: null,
                              logo_scale: 1,
                              logo_offset_x: 0,
                              logo_offset_y: 0,
                            })
                            setLogoUrl(null)
                            setLogoScale(1)
                            setLogoOffsetX(0)
                            setLogoOffsetY(0)
                          }}
                          className="mt-4 text-xs text-stone-500 hover:text-red-600 transition"
                        >
                          {t('cz.branding.removeLogo')}
                        </button>
                      </>
                    )}
                  </Field>
                </>
              )}

              {tab === 'theme' && (
                <>
                  <Field
                    label={t('cz.theme.palette')}
                    hint={t('cz.theme.paletteHint')}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
                        const p = PALETTES[id]
                        const active = theme.palette === id
                        return (
                          <button
                            key={id}
                            onClick={() =>
                              setTheme({ ...theme, palette: id })
                            }
                            className={`rounded-xl border p-3 text-start transition ${
                              active
                                ? 'border-stone-900 ring-2 ring-stone-900/10'
                                : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <div
                              className="rounded-lg overflow-hidden mb-2 border border-black/5"
                              style={{ background: p.bg }}
                            >
                              <div className="flex items-center gap-1 p-1.5">
                                <span
                                  className="w-4 h-4 rounded-full"
                                  style={{ background: p.primary }}
                                />
                                <span
                                  className="w-4 h-4 rounded-full"
                                  style={{ background: p.accent }}
                                />
                                <span
                                  className="w-4 h-4 rounded-full border border-black/5"
                                  style={{ background: p.surface }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium">
                                {p.name}
                              </div>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-stone-900" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  <Field
                    label={t('cz.theme.primaryColor')}
                    hint={t('cz.theme.primaryColorHint')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          value={theme.primary ?? palette.primary}
                          onChange={(e) =>
                            setTheme({ ...theme, primary: e.target.value })
                          }
                          className="w-11 h-11 rounded-lg border border-stone-200 cursor-pointer opacity-0 absolute inset-0"
                        />
                        <div
                          className="w-11 h-11 rounded-lg border border-stone-200 pointer-events-none"
                          style={{
                            background: theme.primary ?? palette.primary,
                          }}
                        />
                      </div>
                      <input
                        value={theme.primary ?? palette.primary}
                        onChange={(e) =>
                          setTheme({ ...theme, primary: e.target.value })
                        }
                        className={`${INPUT_CLASS} font-mono text-xs`}
                      />
                      {theme.primary && (
                        <button
                          onClick={() =>
                            setTheme({ ...theme, primary: undefined })
                          }
                          className="text-xs text-stone-500 hover:text-stone-800 whitespace-nowrap"
                        >
                          {t('cz.branding.reset')}
                        </button>
                      )}
                    </div>
                  </Field>

                  <Field label={t('cz.theme.font')} hint={t('cz.theme.fontHint')}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(Object.keys(FONTS) as FontId[]).map((id) => {
                        const f = FONTS[id]
                        const active = theme.font === id
                        return (
                          <button
                            key={id}
                            onClick={() => setTheme({ ...theme, font: id })}
                            className={`rounded-xl border p-3 text-start transition ${
                              active
                                ? 'border-stone-900 ring-2 ring-stone-900/10'
                                : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <div className="text-2xl leading-none mb-2">
                              Aa
                            </div>
                            <div className="text-xs font-medium">
                              {f.name}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {f.description}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  <div className="pt-2 border-t border-stone-100">
                    <button
                      onClick={resetTheme}
                      className="inline-flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t('cz.theme.reset')}
                    </button>
                  </div>
                </>
              )}

              {tab === 'game' && (
                <Field
                  label={t('cz.game.waitingGame')}
                  hint={t('cz.game.waitingGameHint')}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: 'catch-beans',
                        name: t('cz.game.catchBeans'),
                        description: t('cz.game.catchBeansHint'),
                        preview: (
                          <div className="w-full h-20 rounded-lg bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center border border-stone-200">
                            <div className="w-8 h-8 rounded-full bg-amber-900 shadow-sm" />
                          </div>
                        ),
                      },
                      {
                        id: 'none',
                        name: t('cz.game.none'),
                        description: t('cz.game.noneHint'),
                        preview: (
                          <div className="w-full h-20 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center">
                            <Coffee className="w-6 h-6 text-stone-300" />
                          </div>
                        ),
                      },
                    ].map((g) => {
                      const active = game === g.id
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGame(g.id)}
                          className={`rounded-xl border p-3 text-start transition ${
                            active
                              ? 'border-stone-900 ring-2 ring-stone-900/10'
                              : 'border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          <div className="mb-3">{g.preview}</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium">
                                {g.name}
                              </div>
                              <div className="text-xs text-stone-500">
                                {g.description}
                              </div>
                            </div>
                            {active && (
                              <Check className="w-4 h-4 text-stone-900" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}

              {tab === 'messages' && (
                <>
                  <Field
                    label={t('cz.messages.preparing')}
                    hint={t('cz.messages.preparingHint')}
                  >
                    <input
                      value={messages.preparing ?? ''}
                      onChange={(e) =>
                        setMessages({
                          ...messages,
                          preparing: e.target.value,
                        })
                      }
                      placeholder={t('cust.preparing')}
                      className={INPUT_CLASS}
                      maxLength={40}
                    />
                  </Field>

                  <Field
                    label={t('cz.messages.ready')}
                    hint={t('cz.messages.readyHint')}
                  >
                    <input
                      value={messages.ready ?? ''}
                      onChange={(e) =>
                        setMessages({ ...messages, ready: e.target.value })
                      }
                      placeholder={t('cust.ready')}
                      className={INPUT_CLASS}
                      maxLength={40}
                    />
                  </Field>

                  <Field label={t('cz.messages.preview')}>
                    <div
                      className="rounded-xl border p-5 space-y-3"
                      style={{
                        background: palette.surface,
                        borderColor: palette.border,
                      }}
                    >
                      <div
                        className="text-[10px] uppercase tracking-wider font-semibold"
                        style={{ color: palette.textMuted }}
                      >
                        {t('cz.messages.orderLabel')}
                      </div>
                      <div>
                        <div
                          className="text-lg font-semibold"
                          style={{ color: palette.text }}
                        >
                          {messages.preparing || t('cust.preparing')}
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: palette.textMuted }}
                        >
                          {t('cust.willRing')}
                        </div>
                      </div>
                      <div
                        className="pt-3 border-t"
                        style={{ borderColor: palette.border }}
                      >
                        <div
                          className="text-lg font-semibold"
                          style={{ color: palette.accent }}
                        >
                          {messages.ready || t('cust.ready')}
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: palette.textMuted }}
                        >
                          {t('cust.pickup')}
                        </div>
                      </div>
                    </div>
                  </Field>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: PREVIEW */}
          <div className="lg:sticky lg:top-20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                {t('cz.livePreview')}
              </div>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-stone-100 border border-stone-200">
                <button
                  onClick={() => setDevice('phone')}
                  className={`p-1.5 rounded-md transition ${
                    device === 'phone'
                      ? 'bg-white shadow-sm text-stone-900'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  title={t('cz.phone')}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDevice('desktop')}
                  className={`p-1.5 rounded-md transition ${
                    device === 'desktop'
                      ? 'bg-white shadow-sm text-stone-900'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  title={t('cz.desktop')}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <CustomerPreview
              device={device}
              palette={palette}
              font={font}
              name={name}
              tagline={tagline}
              logoUrl={logoUrl}
              logoScale={logoScale}
              logoOffsetX={logoOffsetX}
              logoOffsetY={logoOffsetY}
              primaryOverride={theme.primary}
              preparing={messages.preparing || t('cust.preparing')}
              ready={messages.ready || t('cust.ready')}
              game={game}
              labelOrder={t('cz.messages.orderLabel')}
              labelYourOrder={t('cust.yourOrder')}
              labelWhileWait={t('cust.whileYouWait')}
              labelPickup={t('cust.pickup')}
              labelWillRing={t('cust.willRing')}
              labelPreparing={t('cust.preparingStep')}
              labelReady={t('cust.readyStep')}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-semibold text-stone-900">
          {label}
        </label>
        {hint && <p className="text-xs text-stone-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function CustomerPreview({
  device,
  palette,
  font,
  name,
  tagline,
  logoUrl,
  logoScale,
  logoOffsetX,
  logoOffsetY,
  primaryOverride,
  preparing,
  ready,
  game,
  labelOrder,
  labelYourOrder,
  labelWhileWait,
  labelPickup,
  labelWillRing,
  labelPreparing,
  labelReady,
}: {
  device: DeviceId
  palette: ReturnType<typeof getPalette>
  font: ReturnType<typeof getFont>
  name: string
  tagline: string
  logoUrl: string | null
  logoScale: number
  logoOffsetX: number
  logoOffsetY: number
  primaryOverride?: string
  preparing: string
  ready: string
  game: string
  labelOrder: string
  labelYourOrder: string
  labelWhileWait: string
  labelPickup: string
  labelWillRing: string
  labelPreparing: string
  labelReady: string
}) {
  const [mode, setMode] = useState<'preparing' | 'ready'>('preparing')
  const primary = primaryOverride ?? palette.primary

  const bodyFont = font.body.includes('serif')
    ? 'ui-serif, Georgia, serif'
    : 'ui-sans-serif, system-ui, sans-serif'

  const wrapClass =
    device === 'phone' ? 'w-full max-w-[320px] mx-auto' : 'w-full'
  const heightClass = device === 'phone' ? 'h-[560px]' : 'h-[460px]'

  const patternUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='${palette.primary}' stroke-width='1.2' stroke-linecap='round'><g transform='translate(20 20) rotate(-25)'><ellipse cx='0' cy='0' rx='7' ry='10'/><path d='M-3 -6 Q0 0 2 7'/></g><g transform='translate(60 60) rotate(30)'><ellipse cx='0' cy='0' rx='7' ry='10'/><path d='M-3 -6 Q0 0 2 7'/></g></g></svg>`
  )}")`

  return (
    <div className={wrapClass}>
      <div
        className={`${heightClass} rounded-3xl border overflow-hidden shadow-xl flex flex-col relative`}
        style={{
          background: palette.bg,
          color: palette.text,
          borderColor: palette.border,
          fontFamily: bodyFont,
        }}
      >
        {palette.pattern === 'beans' && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: patternUrl,
              backgroundSize: '80px 80px',
              opacity: 0.05,
            }}
          />
        )}

        <div className="relative z-10 flex flex-col h-full">
          <div
            className="px-5 py-4 border-b flex items-center gap-3"
            style={{
              borderColor: palette.border,
              background: palette.surface,
            }}
          >
            <Logo
              url={logoUrl}
              name={name}
              size={34}
              scale={logoScale}
              offsetX={logoOffsetX}
              offsetY={logoOffsetY}
              radius={9}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {name || 'Your shop'}
              </div>
              {tagline && (
                <div
                  className="text-[11px] truncate"
                  style={{ color: palette.textMuted }}
                >
                  {tagline}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-5 py-6 space-y-6">
            <div className="text-center">
              <div
                className="text-[10px] uppercase tracking-widest font-semibold"
                style={{ color: palette.textMuted }}
              >
                {labelYourOrder}
              </div>
              <div className="text-5xl font-bold tabular-nums mt-1">#42</div>
            </div>

            {mode === 'preparing' ? (
              <div className="space-y-3 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: palette.accentSoft }}
                >
                  <Coffee
                    className="w-8 h-8"
                    style={{ color: palette.accent }}
                    strokeWidth={2}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{preparing}</div>
                  <div
                    className="text-xs"
                    style={{ color: palette.textMuted }}
                  >
                    {labelWillRing}
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <div
                    className="h-1 flex-1 max-w-[60px] rounded-full"
                    style={{ background: primary }}
                  />
                  <div
                    className="h-1 flex-1 max-w-[60px] rounded-full"
                    style={{ background: primary }}
                  />
                  <div
                    className="h-1 flex-1 max-w-[60px] rounded-full"
                    style={{ background: palette.border }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: '#d1fae5' }}
                >
                  <Check
                    className="w-8 h-8"
                    style={{ color: '#059669' }}
                    strokeWidth={2.5}
                  />
                </div>
                <div className="space-y-1">
                  <div
                    className="text-lg font-semibold"
                    style={{ color: '#047857' }}
                  >
                    {ready}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: palette.textMuted }}
                  >
                    {labelPickup}
                  </div>
                </div>
              </div>
            )}

            {game !== 'none' && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  borderColor: palette.border,
                  background: palette.surface,
                }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold"
                  style={{
                    borderColor: palette.border,
                    color: palette.textMuted,
                  }}
                >
                  <span>{labelWhileWait}</span>
                  <span>Score 12</span>
                </div>
                <div
                  className="h-24 relative"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 120%, rgba(217,119,6,0.08), transparent 60%)',
                  }}
                >
                  <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-6 rounded-b-[999px] rounded-t-sm"
                    style={{ background: primary }}
                  />
                  <div
                    className="absolute top-3 left-[30%] w-3 h-3 rounded-full"
                    style={{ background: '#78350f' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-3 right-3 flex gap-1 p-0.5 rounded-lg backdrop-blur bg-white/70 border border-stone-200/60 z-20">
          <button
            onClick={() => setMode('preparing')}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition ${
              mode === 'preparing'
                ? 'bg-stone-900 text-white'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            {labelPreparing}
          </button>
          <button
            onClick={() => setMode('ready')}
            className={`text-[10px] px-2 py-1 rounded-md transition ${
              mode === 'ready'
                ? 'bg-stone-900 text-white'
                : 'text-stone-500 hover:text-stone-900'
            } font-medium`}
          >
            {labelReady}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomizePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#faf7f2]">
          <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
        </main>
      }
    >
      <CustomizeContent />
    </Suspense>
  )
}