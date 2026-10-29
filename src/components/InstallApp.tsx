'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  Compass,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  Menu,
  Share,
  Smartphone,
  SquarePlus,
  X,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import type { TranslationKey } from '@/lib/i18n/translations'
import { detectInstallPlatform, type InstallPlatform, type IosSafariUi } from '@/lib/install-platform'
import { storageChanged, useSnoozed } from '@/hooks/useStored'

/* ------------------------------------------------------------------ state */

type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome/Edge/Samsung fire `beforeinstallprompt` once, often right after the
// page loads, so it's captured as soon as this module is loaded.
let deferred: PromptEvent | null = null
let installedNow = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the mini-bar
    deferred = e as PromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    emit()
  })
  // The one-tap prompt needs the service worker (it also gives an offline page).
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  readHandoff()
}

/* ------------------------------------------------------------- handoff */

// Scanning a QR with the iPhone Code Scanner (or tapping a link in Instagram,
// WhatsApp…) opens the page in a mini browser where "Add to Home Screen"
// doesn't exist, and that viewer looks exactly like Safari to a web page.
// The guide offers one tap that hands the page to the real browser with
// ?add=1; the page then knows it's in the real browser and opens the guide
// by itself.
const HANDOFF_PARAM = 'add'
const REAL_BROWSER_KEY = 'beep-real-browser'
let autoGuide = false
let realBrowser = false

function readHandoff() {
  try {
    if (new URLSearchParams(window.location.search).get(HANDOFF_PARAM) === '1') {
      autoGuide = true
      realBrowser = true
      sessionStorage.setItem(REAL_BROWSER_KEY, '1')
    } else if (sessionStorage.getItem(REAL_BROWSER_KEY) === '1') {
      realBrowser = true
    }
  } catch {}
}

function handoffUrl(): URL {
  const u = new URL(window.location.href)
  u.searchParams.set(HANDOFF_PARAM, '1')
  u.hash = ''
  return u
}

/** Link that opens this page in Safari, from any iOS in-app viewer. */
export function safariHref(): string {
  return handoffUrl().href.replace(/^http(s?):/, (_, s) => `x-safari-http${s}:`)
}

/** Link that opens this page in Chrome, from an Android in-app viewer. */
export function chromeHref(): string {
  const u = handoffUrl()
  const scheme = u.protocol.replace(':', '')
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Detected once per page load, so every read returns the same object.
let detected: InstallPlatform | null = null
function platformSnapshot(): InstallPlatform {
  return (detected ??= detect())
}

function detect(): InstallPlatform {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return detectInstallPlatform({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
  })
}

/** Platform + whether the browser's own one-tap prompt is available. */
export function useInstall() {
  // The server render knows nothing about the browser: null there and during
  // hydration, the detected platform right after.
  const platform = useSyncExternalStore(subscribe, platformSnapshot, () => null)
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false)
  const justInstalled = useSyncExternalStore(subscribe, () => installedNow, () => false)

  const installed = justInstalled || platform?.kind === 'installed'
  // Something we can offer: the native prompt, or steps for a phone.
  const available =
    !!platform && !installed && (canPrompt || (platform.kind !== 'desktop'))

  async function promptInstall(): Promise<boolean> {
    const e = deferred
    if (!e) return false
    deferred = null
    emit()
    await e.prompt()
    const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }))
    return choice.outcome === 'accepted'
  }

  return { platform, canPrompt, installed, available, promptInstall }
}

/* ------------------------------------------------------------------ button */

type Variant = 'staff' | 'customer'

/**
 * "Add to Home Screen". One tap opens the browser's own install dialog when
 * it has one (Android Chrome, Edge…); otherwise it opens a picture guide for
 * this exact phone and browser.
 */
export function InstallButton({
  variant = 'staff',
  className = '',
  label,
}: {
  variant?: Variant
  className?: string
  label?: string
}) {
  const t = useT()
  const { platform, canPrompt, available, installed, promptInstall } = useInstall()
  const [open, setOpen] = useState(false)

  if (installed) {
    return (
      <div className={`inline-flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 ${className}`}>
        <Check className="w-4 h-4" /> {t('install.done')}
      </div>
    )
  }
  if (!available || !platform) return null

  async function onClick() {
    if (canPrompt) {
      const ok = await promptInstall()
      if (ok) return
      // Dismissed: the browser won't offer it again soon, fall back to steps.
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.99] ${className}`}
        style={
          className.includes('bg-')
            ? undefined
            : { background: 'var(--primary, #1c1917)', color: 'var(--primary-text, #fafaf9)' }
        }
      >
        {canPrompt ? <Download className="w-4 h-4" /> : <SquarePlus className="w-4 h-4" />}
        {label ?? t('install.button')}
      </button>
      {open && <InstallGuide platform={platform} variant={variant} onClose={() => setOpen(false)} />}
    </>
  )
}

/* ------------------------------------------------------------------- guide */

type Step = { icon: React.ReactNode; text: string }

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-800">
      {children}
    </span>
  )
}

function stepsFor(
  p: InstallPlatform,
  variant: Variant,
  t: (k: TranslationKey) => string,
  /** iPhone Safari: what the person says their bar looks like (overrides detection). */
  iosUi?: IosSafariUi,
): {
  steps: Step[]
  /** Where the button to tap is on screen, so the arrow can point at it. */
  point: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-right' | null
  openInBrowser?: 'safari' | 'chrome'
} {
  const addRow: Step = { icon: <SquarePlus className="w-5 h-5" />, text: t('install.ios.add') }
  const notify: Step[] =
    variant === 'customer' ? [{ icon: <Bell className="w-5 h-5" />, text: t('install.customer.notify') }] : []

  switch (p.kind) {
    case 'ios-safari': {
      const ui = p.ipad ? 'classic' : (iosUi ?? p.ui)
      if (ui === 'ios27') {
        // iOS 27: ☰ "Page Menu" on the left of the address bar → Share.
        return {
          point: 'bottom-left',
          steps: [
            { icon: <Menu className="w-5 h-5" />, text: t('install.ios27.menu') },
            { icon: <Share className="w-5 h-5" />, text: t('install.ios26.share') },
            addRow,
            { icon: <Check className="w-5 h-5" />, text: t('install.ios26.confirm') },
            ...notify,
          ],
        }
      }
      if (ui === 'ios26') {
        return {
          point: 'bottom-right',
          steps: [
            { icon: <Ellipsis className="w-5 h-5" />, text: t('install.ios26.more') },
            { icon: <Share className="w-5 h-5" />, text: t('install.ios26.share') },
            addRow,
            { icon: <Check className="w-5 h-5" />, text: t('install.ios26.confirm') },
            ...notify,
          ],
        }
      }
      return {
        point: p.ipad ? 'top-right' : 'bottom-center',
        steps: [
          { icon: <Share className="w-5 h-5" />, text: p.ipad ? t('install.ipad.share') : t('install.ios.share') },
          addRow,
          { icon: <Check className="w-5 h-5" />, text: p.ui === 'classic' ? t('install.ios.confirm') : t('install.ios26.confirm') },
          ...notify,
        ],
      }
    }
    case 'ios-browser':
      return {
        point: 'top-right',
        steps: [
          { icon: <Share className="w-5 h-5" />, text: t('install.iosChrome.share') },
          addRow,
          { icon: <Check className="w-5 h-5" />, text: t('install.ios.confirm') },
          ...notify,
        ],
      }
    case 'ios-inapp':
      return {
        point: 'top-right',
        openInBrowser: 'safari',
        steps: [
          { icon: <Ellipsis className="w-5 h-5" />, text: t('install.inapp.menu') },
          { icon: <Smartphone className="w-5 h-5" />, text: t('install.inapp.safari') },
          { icon: <SquarePlus className="w-5 h-5" />, text: t('install.inapp.then') },
        ],
      }
    case 'android-inapp':
      return {
        point: 'top-right',
        openInBrowser: 'chrome',
        steps: [
          { icon: <EllipsisVertical className="w-5 h-5" />, text: t('install.inapp.menu') },
          { icon: <Smartphone className="w-5 h-5" />, text: t('install.inapp.chrome') },
          { icon: <SquarePlus className="w-5 h-5" />, text: t('install.inapp.then') },
        ],
      }
    case 'samsung':
      return {
        point: 'bottom-right',
        steps: [
          { icon: <Menu className="w-5 h-5" />, text: t('install.samsung.menu') },
          { icon: <SquarePlus className="w-5 h-5" />, text: t('install.samsung.add') },
          { icon: <Check className="w-5 h-5" />, text: t('install.android.confirm') },
        ],
      }
    case 'android':
      return {
        point: 'top-right',
        steps: [
          { icon: <EllipsisVertical className="w-5 h-5" />, text: t('install.android.menu') },
          { icon: <Download className="w-5 h-5" />, text: t('install.android.add') },
          { icon: <Check className="w-5 h-5" />, text: t('install.android.confirm') },
        ],
      }
    default:
      return {
        point: null,
        steps: [{ icon: <Download className="w-5 h-5" />, text: t('install.desktop') }],
      }
  }
}

function InstallGuide({
  platform,
  variant,
  onClose,
}: {
  platform: InstallPlatform
  variant: Variant
  onClose: () => void
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const { canPrompt, promptInstall } = useInstall()
  // iPhone Safari's bar depends on the iOS version AND a Safari setting
  // (Compact / Bottom / Top) that a web page can't read, so the person can
  // switch to what they actually see.
  const [iosUi, setIosUi] = useState<IosSafariUi | undefined>(undefined)
  const iphoneSafari = platform.kind === 'ios-safari' && !platform.ipad
  const shownUi = platform.kind === 'ios-safari' ? (iosUi ?? platform.ui) : undefined
  const { steps, point, openInBrowser } = stepsFor(platform, variant, t, iosUi)
  // Keep the browser's bar visible: card at the top when the button to tap is
  // at the bottom of the screen, and the other way round.
  const cardAtTop = point === 'bottom-center' || point === 'bottom-right' || point === 'bottom-left'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const arrowPos =
    point === 'bottom-center'
      ? 'bottom-3 left-1/2 -translate-x-1/2'
      : point === 'bottom-left'
        ? 'bottom-3 left-14'
        : point === 'bottom-right'
        ? 'bottom-3 right-5'
        : point === 'top-right'
          ? 'top-3 right-4'
          : ''

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center ${cardAtTop ? 'items-start' : 'items-end'} sm:items-center p-3`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
    >
      <button aria-label={t('qr.close')} className="absolute inset-0 bg-stone-900/45" onClick={onClose} />

      {point && (
        <div className={`pointer-events-none fixed ${arrowPos} sm:hidden`} aria-hidden>
          <span className="flex w-12 h-12 rounded-full bg-amber-400 text-stone-900 items-center justify-center shadow-lg animate-bounce">
            {cardAtTop ? <ArrowDown className="w-6 h-6" strokeWidth={3} /> : <ArrowUp className="w-6 h-6" strokeWidth={3} />}
          </span>
        </div>
      )}

      <div
        dir="auto"
        className={`relative w-full max-w-md bg-[#faf7f2] text-stone-900 rounded-3xl shadow-xl max-h-[78vh] overflow-y-auto ${cardAtTop ? 'mt-2' : 'mb-2'}`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-stone-900 text-amber-50 flex items-center justify-center">
              <SquarePlus className="w-5 h-5" />
            </span>
            <div>
              <h2 id="install-title" className="text-lg font-semibold tracking-tight leading-tight">
                {openInBrowser ? t('install.inapp.title') : t('install.title')}
              </h2>
              <p className="text-sm text-stone-500 leading-snug">
                {variant === 'customer' ? t('install.customer.why') : t('install.staff.why')}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('qr.close')} className="p-2 -m-1 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-200/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Maybe in the Code Scanner / Camera viewer: one tap to real Safari. */}
        {iphoneSafari && !realBrowser && (
          <div className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2" data-testid="scanner-handoff">
            <p className="text-sm font-semibold leading-snug">{t('install.scanner.title')}</p>
            <p className="text-xs text-stone-600 leading-snug">{t('install.scanner.body')}</p>
            <a
              href={safariHref()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-amber-50 text-sm font-semibold active:scale-[0.99]"
            >
              <Compass className="w-4 h-4" />
              {t('install.openSafari')}
            </a>
          </div>
        )}

        {/* In-app browser: hand the page to the real browser in one tap. */}
        {openInBrowser && (
          <div className="px-5 pt-4 space-y-2">
            <a
              href={openInBrowser === 'safari' ? safariHref() : chromeHref()}
              data-testid="open-in-browser"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-stone-900 text-amber-50 text-[15px] font-semibold active:scale-[0.99]"
            >
              <Compass className="w-5 h-5" />
              {openInBrowser === 'safari' ? t('install.openSafari') : t('install.openChrome')}
            </a>
            <p className="text-xs text-stone-500 text-center leading-snug">{t('install.openAuto')}</p>
            <p className="text-xs font-semibold text-stone-500 pt-2">{t('install.inapp.fallback')}</p>
          </div>
        )}

        <ol className="px-5 py-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-stone-900 text-amber-50 text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <Chip>{s.icon}</Chip>
              <span className="text-[15px] leading-snug">{s.text}</span>
            </li>
          ))}
        </ol>

        {iphoneSafari && (
          <div className="px-5 pb-4 -mt-1 space-y-2" data-testid="ios-ui-switch">
            <p className="text-xs text-stone-500">{t('install.ui.different')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['ios27', <Menu key="i" className="w-4 h-4" />, t('install.ui.menuLeft')],
                  ['ios26', <Ellipsis key="i" className="w-4 h-4" />, t('install.ui.moreRight')],
                  ['classic', <Share key="i" className="w-4 h-4" />, t('install.ui.shareButton')],
                ] as const
              ).map(([ui, icon, label]) => (
                <button
                  key={ui}
                  onClick={() => setIosUi(ui)}
                  aria-pressed={shownUi === ui}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] leading-tight transition ${
                    shownUi === ui
                      ? 'border-stone-900 bg-stone-900 text-amber-50'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 pb-5 space-y-2">
          {canPrompt && !openInBrowser && (
            <button
              type="button"
              onClick={async () => {
                if (await promptInstall()) onClose()
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-400 text-stone-900 text-sm font-semibold"
            >
              <Download className="w-4 h-4" />
              {t('install.installNow')}
            </button>
          )}
          {openInBrowser && (
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-stone-200 text-sm font-medium hover:bg-stone-50"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t('install.copied') : t('install.copyLink')}
            </button>
          )}
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-stone-900 text-amber-50 text-sm font-semibold hover:bg-stone-800">
            {t('install.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ auto guide */

const autoSnapshot = () => autoGuide

/**
 * Put once on a page. When the page was just handed over from an in-app
 * viewer (?add=1), it opens the right guide right away, so the person only
 * has the browser's own taps left.
 */
export function InstallAutoGuide({ variant }: { variant: Variant }) {
  const { platform, installed } = useInstall()
  const show = useSyncExternalStore(subscribe, autoSnapshot, () => false)

  // Drop ?add=1 from the address once the page is up, so a reload or a
  // shared link doesn't reopen the guide. (Home Screen icon uses the
  // manifest's start_url, not this address.)
  useEffect(() => {
    if (!show) return
    const id = setTimeout(() => {
      try {
        const u = new URL(window.location.href)
        u.searchParams.delete(HANDOFF_PARAM)
        window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
      } catch {}
    }, 0)
    return () => clearTimeout(id)
  }, [show])

  if (!show || !platform || installed || platform.kind === 'desktop') return null
  return (
    <InstallGuide
      platform={platform}
      variant={variant}
      onClose={() => {
        autoGuide = false
        emit()
      }}
    />
  )
}

/* -------------------------------------------------------------- dashboard */

const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

/** Dashboard card: "Install Beep on this phone". Hidden once installed. */
export function InstallCard({ shopId }: { shopId: string }) {
  const t = useT()
  const { available, canPrompt, platform } = useInstall()
  const key = `install-card-later:${shopId}`
  const snoozed = useSnoozed(key, SNOOZE_MS)
  const [closed, setClosed] = useState(false)
  const hidden = snoozed || closed

  // On a computer, only when the browser itself can install it.
  if (hidden || !available || !platform || (platform.kind === 'desktop' && !canPrompt)) return null

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t('install.card.title')}</div>
          <p className="text-sm text-stone-500 leading-snug">{t('install.card.body')}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <InstallButton
          variant="staff"
          className="flex-1 py-3 rounded-xl bg-stone-900 text-amber-50 text-sm hover:bg-stone-800"
        />
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(key, String(Date.now()))
            } catch {}
            storageChanged()
            setClosed(true)
          }}
          className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-2 shrink-0"
        >
          {t('phone.later')}
        </button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- customer */

/**
 * Order page. iPhone only sends the "order ready" alert to pages added to the
 * Home Screen, so there it explains why and offers the guide. On Android the
 * alert already works in the browser: only the one-tap install is offered.
 */
export function CustomerInstall() {
  const t = useT()
  const { platform, canPrompt, installed } = useInstall()
  if (!platform || installed) return null
  const ios = platform.kind === 'ios-safari' || platform.kind === 'ios-browser' || platform.kind === 'ios-inapp'

  if (ios) {
    return (
      <div className="rounded-xl border p-4 space-y-3 bg-white" style={{ borderColor: 'var(--border, #e7e5e4)' }}>
        <p className="text-[15px] leading-snug" style={{ color: 'var(--text, #1c1917)' }}>
          {t('install.customer.hint')}
        </p>
        <InstallButton variant="customer" className="w-full py-3 rounded-xl text-sm" />
      </div>
    )
  }
  if (canPrompt) {
    return <InstallButton variant="customer" className="w-full py-3 rounded-xl text-sm" />
  }
  return null
}
