'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bug,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Star,
  Store,
  X,
} from 'lucide-react'
import CupLogo from '@/components/CupLogo'
import { Toast, type ToastKind } from '@/components/ui/Toast'
import { useToasts } from '@/hooks/useToasts'
import { adminFetch, cx } from './ui'

/* -------------------------------------------------------------- contexts */

type Badges = { pending: number; unreadSupport: number; errors24h: number }
const ZERO: Badges = { pending: 0, unreadSupport: 0, errors24h: 0 }

type ShellCtx = {
  badges: Badges
  refreshBadges: () => void
  toast: (kind: ToastKind, msg: string) => void
}

const Ctx = createContext<ShellCtx>({
  badges: ZERO,
  refreshBadges: () => {},
  toast: () => {},
})

export const useAdmin = () => useContext(Ctx)

/* ------------------------------------------------------------------- nav */

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: keyof Badges
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Run',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/shops', label: 'Cafés', icon: Store, badge: 'pending' },
      { href: '/admin/live', label: 'Live orders', icon: Activity },
      { href: '/admin/support', label: 'Support', icon: MessageSquare, badge: 'unreadSupport' },
      { href: '/admin/billing', label: 'Billing', icon: CreditCard },
    ],
  },
  {
    section: 'Monitor',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/activity', label: 'Activity log', icon: History },
      { href: '/admin/errors', label: 'App errors', icon: Bug, badge: 'errors24h' },
    ],
  },
  {
    section: 'Configure',
    items: [
      { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
      { href: '/admin/settings', label: 'Settings & security', icon: Settings },
    ],
  },
]

const MOBILE_TABS: NavItem[] = [
  { href: '/admin', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/shops', label: 'Cafés', icon: Store, badge: 'pending' },
  { href: '/admin/live', label: 'Live', icon: Activity },
  { href: '/admin/support', label: 'Support', icon: MessageSquare, badge: 'unreadSupport' },
]

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/')
}

function BadgeDot({ n, tone = 'red' }: { n: number; tone?: 'red' | 'amber' }) {
  if (!n) return null
  return (
    <span
      className={cx(
        'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold leading-[18px] text-center text-white tabular-nums',
        tone === 'red' ? 'bg-red-500' : 'bg-amber-500',
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

/* ----------------------------------------------------------------- shell */

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin'
  const isLogin = pathname.startsWith('/admin/login')
  if (isLogin) return <>{children}</>
  return <Shell pathname={pathname}>{children}</Shell>
}

function Shell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const router = useRouter()
  const [badges, setBadges] = useState<Badges>(ZERO)
  // The "More" sheet is open for the path it was opened on, so navigating closes it.
  const [moreOpenOn, setMoreOpenOn] = useState<string | null>(null)
  const moreOpen = moreOpenOn === pathname
  const setMoreOpen = (open: boolean) => setMoreOpenOn(open ? pathname : null)
  const { toasts, push, dismiss } = useToasts()

  const refreshBadges = useCallback(async () => {
    try {
      const r = await adminFetch<Badges>('/api/admin/badges')
      if (r.ok) setBadges({ ...ZERO, ...r.data })
    } catch {
      /* offline — keep last values */
    }
  }, [])

  useEffect(() => {
    // Fetch on mount; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshBadges()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshBadges()
    }, 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshBadges()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshBadges])

  // Home-screen icon badge (iOS 16.4+ PWA, Android, desktop).
  useEffect(() => {
    const n = badges.pending + badges.unreadSupport
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (n > 0) nav.setAppBadge?.(n).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }, [badges.pending, badges.unreadSupport])

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    router.replace('/admin/login')
  }

  const ctx = useMemo<ShellCtx>(
    () => ({ badges, refreshBadges, toast: push }),
    [badges, refreshBadges, push],
  )

  const moreHasBadge = badges.errors24h > 0

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        {/* Sidebar (md+) */}
        <aside className="hidden md:flex fixed inset-y-0 start-0 w-60 flex-col border-e border-zinc-200 bg-white">
          <div className="h-14 flex items-center gap-2.5 px-4 border-b border-zinc-100">
            <CupLogo size={26} />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Cup Admin</div>
              <div className="text-[10px] text-zinc-500">Control panel</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {NAV.map((group) => (
              <div key={group.section}>
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.section}
                </div>
                {group.items.map((item) => (
                  <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} badges={badges} />
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-zinc-100 p-2">
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-sm text-zinc-600 hover:bg-red-50 hover:text-red-600 transition"
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </aside>

        {/* Top bar (mobile) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-zinc-200 pt-[env(safe-area-inset-top)]">
          <div className="h-12 flex items-center justify-between px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <CupLogo size={22} />
              <span className="text-sm font-semibold">Cup Admin</span>
            </Link>
            <Link href="/admin/settings" className="p-2 -me-2 text-zinc-500" aria-label="Settings">
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <main className="md:ps-60">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-8 pt-4 md:py-8 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-10">{children}</div>
        </main>

        {/* Bottom tabs (mobile) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-zinc-200 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {MOBILE_TABS.map((item) => {
              const active = isActive(pathname, item.href)
              const n = item.badge ? badges[item.badge] : 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx('relative flex flex-col items-center justify-center h-14 gap-0.5 text-[10px] font-medium', active ? 'text-zinc-900' : 'text-zinc-400')}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                  {n > 0 && (
                    <span className="absolute top-1.5 start-1/2 ms-1.5">
                      <BadgeDot n={n} tone={item.badge === 'pending' ? 'amber' : 'red'} />
                    </span>
                  )}
                </Link>
              )
            })}
            <button
              onClick={() => setMoreOpen(true)}
              className="relative flex flex-col items-center justify-center h-14 gap-0.5 text-[10px] font-medium text-zinc-400"
            >
              <MoreHorizontal className="w-5 h-5" />
              More
              {moreHasBadge && <span className="absolute top-2 start-1/2 ms-2 w-2 h-2 rounded-full bg-red-500" />}
            </button>
          </div>
        </nav>

        {/* "More" sheet (mobile) */}
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMoreOpen(false)}>
            <div
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-sm font-semibold">Menu</span>
                <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-100" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {NAV.map((group) => (
                <div key={group.section} className="mb-2">
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{group.section}</div>
                  {group.items.map((item) => (
                    <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} badges={badges} large />
                  ))}
                </div>
              ))}
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 rounded-lg px-3 h-11 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          </div>
        )}

        {/* transform makes this the containing block, so toasts sit above the tab bar */}
        <div className="fixed inset-x-0 z-[110] bottom-[calc(env(safe-area-inset-bottom)+60px)] md:bottom-0 [transform:translateZ(0)]">
          <Toast toasts={toasts} onDismiss={dismiss} />
        </div>
      </div>
    </Ctx.Provider>
  )
}

function SideLink({
  item,
  active,
  badges,
  large,
}: {
  item: NavItem
  active: boolean
  badges: Badges
  large?: boolean
}) {
  const n = item.badge ? badges[item.badge] : 0
  return (
    <Link
      href={item.href}
      className={cx(
        'flex items-center gap-2.5 rounded-lg px-2.5 text-sm transition',
        large ? 'h-11' : 'h-9',
        active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100',
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      <BadgeDot n={n} tone={item.badge === 'pending' ? 'amber' : 'red'} />
    </Link>
  )
}
