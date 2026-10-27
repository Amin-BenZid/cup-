'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Lock,
  MessageCircle,
  MessageSquare,
  Phone,
  RotateCcw,
  Trash2,
  Unlock,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  BarChart,
  Button,
  Card,
  cx,
  dayLabel,
  duration,
  Empty,
  ErrorBanner,
  Field,
  fmtDate,
  inputCls,
  OrderStatus,
  Pill,
  Segmented,
  ShopAvatar,
  Skeleton,
  Stat,
  StateBadge,
  timeAgo,
  useAdminData,
  useNow,
  type ShopState,
} from '@/components/admin/ui'
import { describeHistory } from '@/components/admin/history'

type Shop = {
  id: string
  name: string
  tagline: string | null
  code: string
  phone: string | null
  status: string
  state: ShopState
  created_at: string
  logo_url: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
  billing_status: string | null
  paid_current_month: boolean | null
  login_attempts: number | null
  locked_until: string | null
  has_created_order: boolean | null
  days_left: number
  is_trial: boolean
}

type Order = {
  id: string
  order_number: string
  status: 'preparing' | 'ready' | 'done'
  created_at: string
  ready_at: string | null
  customer_connected: boolean
  customer_phone: string | null
}

type Detail = {
  shop: Shop
  orders: Order[]
  reviews: { rating: number; comment: string | null; created_at: string }[]
  history: { id: string; action: string; details: unknown; created_at: string }[]
  messages: { id: string; message: string; sender: 'barista' | 'admin'; is_read: boolean; created_at: string }[]
  reviewStats: { count: number; average: number }
  stats: { total: number; last30: number; avgPrepSec: number | null; connectRate: number | null; daily: { day: string; count: number }[] }
}

type Tab = 'overview' | 'edit' | 'orders' | 'feedback' | 'history'

const FACES = ['', '😞', '🙂', '😍']

function toDateInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''
}

/** Date input (YYYY-MM-DD) → end of that day, Tunisia time (UTC+1). */
function fromDateInput(v: string) {
  return v ? new Date(`${v}T23:59:59+01:00`).toISOString() : null
}

export default function ShopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const { toast, refreshBadges } = useAdmin()
  const { data, setData, error, loading, reload } = useAdminData<Detail>(id ? `/api/admin/shops/${id}` : null)
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | { title: string; description?: string; label: string; danger?: boolean; run: () => Promise<void> }>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const shop = data?.shop

  async function patch(body: Record<string, unknown>, success: string, key = 'patch') {
    setBusy(key)
    const r = await adminFetch<{ shop: Shop }>(`/api/admin/shops/${id}`, { method: 'PATCH', body })
    setBusy(null)
    if (!r.ok) {
      toast('error', r.data.error ?? 'Failed')
      return false
    }
    setData((prev) => (prev ? { ...prev, shop: { ...prev.shop, ...r.data.shop } } : prev))
    toast('success', success)
    refreshBadges()
    void reload()
    return true
  }

  async function extend(months: number) {
    setBusy(`extend-${months}`)
    const r = await adminFetch(`/api/admin/shops/${id}/billing`, { method: 'POST', body: { months } })
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', `Subscription extended by ${months} month${months > 1 ? 's' : ''}`)
    void reload()
  }

  if (!id) return null

  return (
    <div>
      <Link href="/admin/shops" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-3">
        <ArrowLeft className="w-4 h-4" /> Cafés
      </Link>
      <ErrorBanner message={error} onRetry={reload} />

      {!shop ? (
        loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-64" />
          </div>
        ) : null
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ShopAvatar name={shop.name} logo={shop.logo_url} size={52} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate max-w-full">{shop.name}</h1>
                  <StateBadge state={shop.state} trial={shop.is_trial} />
                  {isLocked(shop) && (
                    <Pill className="bg-red-100 text-red-700">
                      <Lock className="w-3 h-3" /> Login locked
                    </Pill>
                  )}
                </div>
                <div className="text-sm text-zinc-500 truncate">
                  {shop.code} · joined {fmtDate(shop.created_at)}
                  {shop.tagline ? ` · ${shop.tagline}` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
              {shop.phone && (
                <>
                  <a href={`tel:${shop.phone}`} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-300 bg-white text-sm hover:bg-zinc-50">
                    <Phone className="w-4 h-4" /> Call
                  </a>
                  <a
                    href={`https://wa.me/${shop.phone.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-300 bg-white text-sm hover:bg-zinc-50"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                </>
              )}
              <Link href={`/admin/support?shop=${shop.id}`} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-300 bg-white text-sm hover:bg-zinc-50">
                <MessageSquare className="w-4 h-4" /> Message
              </Link>
            </div>
          </div>

          {/* Primary status action */}
          {shop.state === 'pending' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-5">
              <div className="flex-1 text-sm text-amber-900">
                <span className="font-medium">Waiting for approval.</span> Signed up {timeAgo(shop.created_at)}. Their 15-day trial is already running.
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" loading={busy === 'decline'} onClick={() => patch({ status: 'disabled' }, 'Declined', 'decline')}>
                  Decline
                </Button>
                <Button variant="success" loading={busy === 'approve'} onClick={() => patch({ status: 'active' }, 'Approved — they can log in now', 'approve')}>
                  <Check className="w-4 h-4" /> Approve
                </Button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'overview', label: 'Overview' },
                { value: 'edit', label: 'Edit & access' },
                { value: 'orders', label: 'Orders', count: data.orders.filter((o) => o.status !== 'done').length || undefined },
                { value: 'feedback', label: 'Reviews', count: data.reviewStats.count },
                { value: 'history', label: 'History' },
              ]}
            />
          </div>

          {tab === 'overview' && (
            <OverviewTab
              data={data}
              busy={busy}
              onExtend={(m) =>
                setConfirm({
                  title: `Extend by ${m} month${m > 1 ? 's' : ''}?`,
                  description: 'Adds time to the subscription (from today if it already ended) and marks this month as paid.',
                  label: 'Extend',
                  run: () => extend(m),
                })
              }
              onPatch={patch}
              onDisable={() =>
                setConfirm({
                  title: `Disable ${shop.name}?`,
                  description: 'Baristas are logged out of every feature until you enable it again. Nothing is deleted.',
                  label: 'Disable',
                  danger: true,
                  run: async () => {
                    await patch({ status: 'disabled' }, 'Café disabled', 'disable')
                  },
                })
              }
            />
          )}

          {tab === 'edit' && (
            <EditTab
              key={[shop.name, shop.tagline, shop.code, shop.phone, shop.trial_ends_at, shop.subscription_ends_at].join('|')}
              shop={shop}
              busy={busy}
              onPatch={patch}
              onDelete={() => setDeleteOpen(true)}
            />
          )}

          {tab === 'orders' && <OrdersTab orders={data.orders} onChanged={reload} />}

          {tab === 'feedback' && (
            <Card padded={false}>
              {data.reviews.length === 0 ? (
                <Empty title="No reviews yet" />
              ) : (
                <>
                  <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-100 text-sm">
                    <span className="font-semibold tabular-nums">{data.reviewStats.average} / 3</span>
                    {[3, 2, 1].map((r) => (
                      <span key={r} className="text-zinc-500 tabular-nums">
                        {FACES[r]} {data.reviews.filter((x) => x.rating === r).length}
                      </span>
                    ))}
                  </div>
                  <ul className="divide-y divide-zinc-100">
                    {data.reviews.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 px-4 py-3">
                        <span className="text-xl leading-none">{FACES[r.rating]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-800">{r.comment || <span className="text-zinc-400">No comment</span>}</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">{fmtDate(r.created_at, true)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          {tab === 'history' && (
            <Card padded={false}>
              {data.history.length === 0 ? (
                <Empty title="No history" />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {data.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="text-zinc-700 first-letter:uppercase">{describeHistory(h.action, h.details)}</span>
                      <span className="text-[11px] text-zinc-400 shrink-0">{fmtDate(h.created_at, true)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        confirmLabel={confirm?.label}
        variant={confirm?.danger ? 'danger' : 'default'}
        loading={busy !== null}
        onConfirm={async () => {
          const c = confirm
          setConfirm(null)
          await c?.run()
        }}
      />

      {shop && deleteOpen && (
        <DeleteDialog
          open
          shop={shop}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            toast('success', `${shop.name} deleted`)
            refreshBadges()
            router.replace('/admin/shops')
          }}
        />
      )}
    </div>
  )
}

function isLocked(s: Shop) {
  return !!s.locked_until && new Date(s.locked_until).getTime() > Date.now()
}

/* --------------------------------------------------------------- overview */

function OverviewTab({
  data,
  busy,
  onExtend,
  onPatch,
  onDisable,
}: {
  data: Detail
  busy: string | null
  onExtend: (m: number) => void
  onPatch: (body: Record<string, unknown>, msg: string, key?: string) => Promise<boolean>
  onDisable: () => void
}) {
  const { shop, stats, reviewStats, messages } = data
  const reminder = useMemo(() => {
    if (!shop.phone) return null
    const msg = `Bonjour ${shop.name}, c'est l'équipe Beep. Votre abonnement arrive à échéance. Souhaitez-vous continuer ?`
    return `https://wa.me/${shop.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`
  }, [shop.phone, shop.name])

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="grid grid-cols-2 [&>*]:min-w-0 md:grid-cols-4 gap-3">
          <Stat label="Orders · 30d" value={stats.last30} hint={`${stats.total} all time`} />
          <Stat label="Avg prep" value={duration(stats.avgPrepSec)} hint="order → ready" />
          <Stat label="Scan rate" value={stats.connectRate === null ? '—' : `${stats.connectRate}%`} hint="customers who opened the page" />
          <Stat label="Rating" value={reviewStats.count ? `${reviewStats.average}/3` : '—'} hint={`${reviewStats.count} reviews`} />
        </div>

        <Card title="Orders · last 30 days">
          <BarChart data={stats.daily.map((d) => ({ label: dayLabel(d.day), value: d.count, title: dayLabel(d.day, false) }))} height={120} />
        </Card>

        <Card title="Latest messages" action={<Link href={`/admin/support?shop=${shop.id}`} className="text-xs text-zinc-500 hover:text-zinc-900">Open thread →</Link>} padded={false}>
          {messages.length === 0 ? (
            <Empty title="No messages" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {messages.map((m) => (
                <li key={m.id} className="px-4 py-2.5 text-sm flex gap-2">
                  <Pill className={m.sender === 'admin' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}>{m.sender === 'admin' ? 'You' : 'Café'}</Pill>
                  <span className="flex-1 min-w-0 truncate text-zinc-700">{m.message}</span>
                  <span className="text-[11px] text-zinc-400 shrink-0">{timeAgo(m.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Subscription">
          <dl className="text-sm space-y-2 mb-4">
            <Row label="Plan">{shop.is_trial ? 'Free trial' : shop.billing_status === 'active' ? 'Paid' : (shop.billing_status ?? '—')}</Row>
            <Row label="Trial ends">{fmtDate(shop.trial_ends_at)}</Row>
            <Row label="Paid until">{fmtDate(shop.subscription_ends_at)}</Row>
            <Row label="Days left">
              <span className={cx('font-medium tabular-nums', shop.days_left <= 3 ? 'text-red-600' : shop.days_left <= 7 ? 'text-amber-600' : '')}>{shop.days_left}</span>
            </Row>
            <Row label="Paid this month">
              <button
                onClick={() => onPatch({ paid_current_month: !shop.paid_current_month }, shop.paid_current_month ? 'Marked unpaid' : 'Marked paid', 'paid')}
                className={cx('inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5', shop.paid_current_month ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600')}
              >
                {shop.paid_current_month ? <CheckCircle2 className="w-3 h-3" /> : null}
                {shop.paid_current_month ? 'Yes' : 'No'} · toggle
              </button>
            </Row>
          </dl>
          <div className="text-xs font-medium text-zinc-700 mb-1.5">Extend subscription</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 3, 6, 12].map((m) => (
              <Button key={m} size="sm" loading={busy === `extend-${m}`} onClick={() => onExtend(m)}>
                +{m}m
              </Button>
            ))}
          </div>
          {reminder && (
            <a href={reminder} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100">
              <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp renewal reminder
            </a>
          )}
          <p className="text-[11px] text-zinc-400 mt-3">Set exact dates in “Edit & access”.</p>
        </Card>

        <Card title="Status">
          <div className="text-sm text-zinc-600 mb-3">
            {shop.status === 'active' && 'Active. Baristas can log in and take orders while the trial or subscription is valid.'}
            {shop.status === 'disabled' && 'Disabled. Baristas are blocked until you enable the café.'}
            {shop.status === 'pending' && 'Pending approval.'}
          </div>
          {shop.status === 'active' ? (
            <Button variant="danger" className="w-full" loading={busy === 'disable'} onClick={onDisable}>
              <Ban className="w-4 h-4" /> Disable café
            </Button>
          ) : (
            <Button variant="success" className="w-full" loading={busy === 'approve'} onClick={() => onPatch({ status: 'active' }, 'Café enabled', 'approve')}>
              <Check className="w-4 h-4" /> {shop.status === 'pending' ? 'Approve' : 'Enable café'}
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 text-end">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------- edit */

function EditTab({
  shop,
  busy,
  onPatch,
  onDelete,
}: {
  shop: Shop
  busy: string | null
  onPatch: (body: Record<string, unknown>, msg: string, key?: string) => Promise<boolean>
  onDelete: () => void
}) {
  const [form, setForm] = useState({
    name: shop.name,
    tagline: shop.tagline ?? '',
    code: shop.code,
    phone: shop.phone ?? '',
  })
  const [dates, setDates] = useState({ trial: toDateInput(shop.trial_ends_at), sub: toDateInput(shop.subscription_ends_at) })
  const [pin, setPin] = useState('')

  const profileDirty =
    form.name !== shop.name || form.tagline !== (shop.tagline ?? '') || form.code !== shop.code || form.phone !== (shop.phone ?? '')
  const datesDirty = dates.trial !== toDateInput(shop.trial_ends_at) || dates.sub !== toDateInput(shop.subscription_ends_at)

  function saveProfile() {
    const body: Record<string, unknown> = {}
    if (form.name !== shop.name) body.name = form.name
    if (form.tagline !== (shop.tagline ?? '')) body.tagline = form.tagline
    if (form.code !== shop.code) body.code = form.code
    if (form.phone !== (shop.phone ?? '')) body.phone = form.phone
    void onPatch(body, 'Saved', 'profile')
  }

  function saveDates() {
    const body: Record<string, unknown> = {}
    if (dates.trial !== toDateInput(shop.trial_ends_at)) body.trial_ends_at = fromDateInput(dates.trial)
    if (dates.sub !== toDateInput(shop.subscription_ends_at)) body.subscription_ends_at = fromDateInput(dates.sub)
    void onPatch(body, 'Billing dates saved', 'dates')
  }

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 lg:grid-cols-2 gap-4">
      <Card title="Profile">
        <div className="space-y-3">
          <Field label="Name">
            <input className={inputCls} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <input className={inputCls} value={form.tagline} maxLength={80} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </Field>
          <Field label="Café code (login)" hint="Changing it changes what baristas type to log in. Tell them first.">
            <input className={inputCls} value={form.code} maxLength={40} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} inputMode="tel" placeholder="+216…" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" disabled={!profileDirty} loading={busy === 'profile'} onClick={saveProfile}>
              Save profile
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Billing dates">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trial ends">
              <input type="date" className={inputCls} value={dates.trial} onChange={(e) => setDates({ ...dates, trial: e.target.value })} />
            </Field>
            <Field label="Paid until">
              <input type="date" className={inputCls} value={dates.sub} onChange={(e) => setDates({ ...dates, sub: e.target.value })} />
            </Field>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">Access ends at 23:59 (Tunisia) on the later of the two dates. Clear a field to remove it.</p>
          <div className="flex justify-end mt-3">
            <Button variant="primary" disabled={!datesDirty} loading={busy === 'dates'} onClick={saveDates}>
              Save dates
            </Button>
          </div>
        </Card>

        <Card title="Barista access">
          <div className="space-y-3">
            <Field label="New 6-digit PIN" hint="Also unlocks the login if it's locked.">
              <div className="flex gap-2">
                <input
                  className={cx(inputCls, 'tracking-[0.3em] tabular-nums')}
                  value={pin}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <Button
                  disabled={pin.length !== 6}
                  loading={busy === 'pin'}
                  onClick={async () => {
                    if (await onPatch({ new_pin: pin }, 'PIN changed — share it with the café', 'pin')) setPin('')
                  }}
                >
                  <KeyRound className="w-4 h-4" /> Set PIN
                </Button>
              </div>
            </Field>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-600">
                {isLocked(shop) ? (
                  <span className="text-red-600">Locked until {fmtDate(shop.locked_until, true)}</span>
                ) : (
                  <>Failed attempts: {shop.login_attempts ?? 0}</>
                )}
              </span>
              <Button size="sm" disabled={!isLocked(shop) && !shop.login_attempts} loading={busy === 'unlock'} onClick={() => onPatch({ unlock: true }, 'Login unlocked', 'unlock')}>
                <Unlock className="w-3.5 h-3.5" /> Unlock
              </Button>
            </div>
            {shop.status !== 'pending' && (
              <div className="flex items-center justify-between gap-3 text-sm pt-1">
                <span className="text-zinc-600">Send back to “pending approval”</span>
                <Button size="sm" variant="ghost" loading={busy === 'pending'} onClick={() => onPatch({ status: 'pending' }, 'Set to pending', 'pending')}>
                  <RotateCcw className="w-3.5 h-3.5" /> Set pending
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card title={<span className="text-red-700">Danger zone</span>} className="border-red-200">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">Delete the café with all its orders, reviews and messages. This can’t be undone.</p>
            <Button variant="danger" onClick={onDelete}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- orders */

function OrdersTab({ orders, onChanged }: { orders: Order[]; onChanged: () => void }) {
  const { toast } = useAdmin()
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [busy, setBusy] = useState<string | null>(null)
  const now = useNow(30_000)
  const list = filter === 'open' ? orders.filter((o) => o.status !== 'done') : orders

  async function setStatus(o: Order, status: Order['status']) {
    setBusy(o.id)
    const r = await adminFetch(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status } })
    setBusy(null)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', `#${o.order_number} → ${status}`)
    onChanged()
  }

  return (
    <Card padded={false}>
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: orders.filter((o) => o.status !== 'done').length },
            { value: 'all', label: 'Last 100' },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <Empty title={filter === 'open' ? 'No open orders' : 'No orders yet'} />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {list.map((o) => {
            const age = (now - new Date(o.created_at).getTime()) / 1000
            const stuck = o.status !== 'done' && age > 3 * 3600
            return (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-14 font-semibold tabular-nums">#{o.order_number}</span>
                <OrderStatus status={o.status} />
                <div className="flex-1 min-w-0 text-xs text-zinc-500">
                  {fmtDate(o.created_at, true)}
                  {o.ready_at && ` · ready in ${duration((new Date(o.ready_at).getTime() - new Date(o.created_at).getTime()) / 1000)}`}
                  {o.customer_connected ? ' · scanned' : ' · not scanned'}
                  {stuck && <span className="text-red-600"> · stuck {duration(age)}</span>}
                </div>
                <a href={`/o/${o.id}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title="Open customer page">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {o.status !== 'done' && (
                  <Button size="sm" loading={busy === o.id} onClick={() => setStatus(o, 'done')}>
                    Close
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ----------------------------------------------------------------- delete */

function DeleteDialog({ open, shop, onClose, onDeleted }: { open: boolean; shop: Shop; onClose: () => void; onDeleted: () => void }) {
  const { toast } = useAdmin()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    const r = await adminFetch(`/api/admin/shops/${shop.id}`, { method: 'DELETE', body: { confirm: typed } })
    setBusy(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    onClose()
    onDeleted()
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={`Delete ${shop.name}?`} description="All orders, reviews, messages and history for this café are deleted permanently.">
      <div className="px-5 pb-5 space-y-3">
        <Field label={`Type the café code “${shop.code}” to confirm`}>
          <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </Field>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <button
            onClick={run}
            disabled={typed !== shop.code || busy}
            className="flex-1 h-9 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
