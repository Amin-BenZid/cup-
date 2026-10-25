'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'

/* ------------------------------------------------------------------ data */

export type FetchResult<T> = { ok: boolean; status: number; data: T & { error?: string } }

/** fetch() for admin APIs: JSON in/out, redirects to login on 401. */
export async function adminFetch<T = Record<string, unknown>>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<FetchResult<T>> {
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    cache: 'no-store',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    // Full reload on purpose: drops all in-memory admin state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/admin/login?next=${next}`
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  return { ok: res.ok, status: res.status, data }
}

/** Load (and optionally poll while the tab is visible) an admin endpoint. */
export function useAdminData<T>(url: string | null, opts?: { pollMs?: number }) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (!url || inFlight.current) return
    inFlight.current = true
    try {
      const r = await adminFetch<T>(url)
      if (r.status === 401) return
      if (!r.ok) setError(r.data.error ?? `Request failed (${r.status})`)
      else {
        setError('')
        setData(r.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    // Fetch on mount; state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const poll = opts?.pollMs
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const id = poll
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void load()
        }, poll)
      : undefined
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      if (id) clearInterval(id)
    }
  }, [load, opts?.pollMs])

  return { data, setData, error, loading, reload: load }
}

/** Current time, re-rendering every `ms` (keeps render pure). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/* ---------------------------------------------------------------- format */

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(s)) return '—'
  if (s < 0) return 'in ' + duration(-s)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`
  return fmtDate(iso)
}

export function duration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d`
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/* -------------------------------------------------------------- layout UI */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-5">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <div className="text-sm text-zinc-500 mt-0.5">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function Card({
  children,
  className,
  title,
  action,
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  title?: React.ReactNode
  action?: React.ReactNode
  padded?: boolean
}) {
  return (
    <section className={cx('bg-white border border-zinc-200 rounded-xl', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>
          {action}
        </div>
      )}
      <div className={padded ? 'px-4 pb-4 pt-1' : ''}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  href,
  icon,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'warn' | 'bad' | 'good'
  href?: string
  icon?: React.ReactNode
}) {
  const inner = (
    <div
      className={cx(
        'h-full bg-white border rounded-xl p-3 sm:p-3.5 transition',
        tone === 'warn' && 'border-amber-300 bg-amber-50/60',
        tone === 'bad' && 'border-red-300 bg-red-50/60',
        tone === 'good' && 'border-emerald-200',
        tone === 'default' && 'border-zinc-200',
        href && 'hover:border-zinc-400',
      )}
    >
      <div className="flex items-center justify-between text-zinc-500">
        <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide truncate">{label}</span>
        {icon}
      </div>
      <div className="mt-1.5 text-xl sm:text-2xl font-semibold tabular-nums text-zinc-900 leading-tight truncate">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>}
    </div>
  )
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}

export type ShopState = 'pending' | 'active' | 'expired' | 'disabled'

export function StateBadge({ state, trial }: { state: ShopState; trial?: boolean }) {
  const map: Record<ShopState, [string, string]> = {
    pending: ['Pending', 'bg-amber-100 text-amber-800'],
    active: [trial ? 'Trial' : 'Active', trial ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'],
    expired: ['Expired', 'bg-orange-100 text-orange-800'],
    disabled: ['Disabled', 'bg-zinc-200 text-zinc-700'],
  }
  const [label, cls] = map[state] ?? map.active
  return <Pill className={cls}>{label}</Pill>
}

export function OrderStatus({ status }: { status: 'preparing' | 'ready' | 'done' | string }) {
  if (status === 'preparing') return <Pill className="bg-amber-100 text-amber-800">Preparing</Pill>
  if (status === 'ready') return <Pill className="bg-emerald-100 text-emerald-800">Ready</Pill>
  return <Pill>Done</Pill>
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', className ?? 'bg-zinc-100 text-zinc-700')}>
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  loading,
  type = 'button',
  className,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-zinc-900 text-white hover:bg-zinc-700',
        variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-500',
        variant === 'secondary' && 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50',
        variant === 'danger' && 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100',
        className,
      )}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-zinc-500 mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full h-10 md:h-9 rounded-lg border border-zinc-300 bg-white px-3 text-base md:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500 disabled:bg-zinc-50'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; count?: number }[]
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition',
              on ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300',
            )}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span className={cx('tabular-nums rounded px-1 text-[10px]', on ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-medium hover:underline">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  )
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="py-10 text-center">
      <div className="text-sm font-medium text-zinc-800">{title}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
      {children}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-zinc-200/70', className)} />
}

export function ShopAvatar({ name, logo, size = 32 }: { name: string; logo?: string | null; size?: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className="rounded-lg object-cover border border-zinc-200 shrink-0 bg-white" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="rounded-lg bg-zinc-900 text-white flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name || '?')[0]?.toUpperCase()}
    </div>
  )
}

/* ----------------------------------------------------------------- charts */

export function BarChart({
  data,
  height = 140,
  format = (v: number) => String(v),
  color = '#18181b',
  labelEvery,
}: {
  data: { label: string; value: number | null; title?: string }[]
  height?: number
  format?: (v: number) => string
  color?: string
  labelEvery?: number
}) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0))
  const n = data.length || 1
  const every = labelEvery ?? Math.ceil(n / 7)
  const [hover, setHover] = useState<number | null>(null)
  const h = hover !== null ? data[hover] : null

  return (
    <div className="relative select-none">
      <div className="h-5 text-[11px] text-zinc-500 tabular-nums">
        {h ? (
          <>
            <span className="font-medium text-zinc-900">{h.value === null ? '—' : format(h.value)}</span>{' '}
            · {h.title ?? h.label}
          </>
        ) : (
          <>max {format(max)}</>
        )}
      </div>
      <div className="flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const v = d.value ?? 0
          const pct = (v / max) * 100
          return (
            <div
              key={i}
              className="flex-1 h-full flex items-end cursor-default"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            >
              <div
                className="w-full rounded-t-[3px] transition-opacity"
                style={{
                  height: `${Math.max(v > 0 ? 3 : 1, pct)}%`,
                  background: v > 0 ? color : '#e4e4e7',
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-zinc-400 tabular-nums overflow-visible whitespace-nowrap">
            {i % every === 0 || i === n - 1 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

/** "2026-10-25" → "25 Oct" */
export function dayLabel(day: string, short = true) {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  return date.toLocaleDateString('en-GB', short ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
