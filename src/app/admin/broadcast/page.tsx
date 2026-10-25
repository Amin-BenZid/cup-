'use client'

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  Button,
  Card,
  cx,
  Empty,
  ErrorBanner,
  fmtDate,
  PageHeader,
  Pill,
  Skeleton,
  useAdminData,
} from '@/components/admin/ui'

type Broadcast = {
  broadcast: { active: boolean; message: string }
  history: { id: string; message: string; active: boolean; created_at: string }[]
}

const MAX = 280

export default function BroadcastPage() {
  const { toast } = useAdmin()
  const { data, error, loading, reload } = useAdminData<Broadcast>('/api/broadcast')
  // Draft starts from the live message; null = "not edited yet".
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const live = data?.broadcast ?? { active: false, message: '' }
  const text = draft ?? live.message

  async function save(active: boolean, message: string) {
    setBusy(true)
    const r = await adminFetch('/api/broadcast', { method: 'PATCH', body: { active, message } })
    setBusy(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', active ? 'Banner is live on every barista dashboard' : 'Banner turned off')
    setDraft(null)
    void reload()
  }

  return (
    <div>
      <PageHeader title="Broadcast" subtitle="A banner shown at the top of every barista dashboard" />
      <ErrorBanner message={error} onRetry={reload} />

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid grid-cols-1 [&>*]:min-w-0 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card
              title="Message"
              action={live.active ? <Pill className="bg-emerald-100 text-emerald-800">● Live</Pill> : <Pill>Off</Pill>}
            >
              <textarea
                value={text}
                onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
                rows={3}
                placeholder="e.g. Maintenance tonight 23:00–23:30, the app may be slow."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500"
              />
              <div className="flex items-center justify-between mt-1 mb-3 text-[11px] text-zinc-400">
                <span>Baristas can dismiss it; a new message shows again.</span>
                <span className="tabular-nums">
                  {text.length}/{MAX}
                </span>
              </div>

              <div className="text-xs font-medium text-zinc-700 mb-1.5">Preview</div>
              <div className={cx('rounded-lg border px-3 py-2 flex items-center gap-2 text-sm mb-4', text ? 'bg-amber-100 border-amber-200 text-amber-900' : 'bg-zinc-50 border-dashed border-zinc-300 text-zinc-400')}>
                <Megaphone className="w-4 h-4 shrink-0" />
                <span className="truncate font-medium">{text || 'Nothing to show'}</span>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                {live.active && (
                  <Button variant="secondary" loading={busy} onClick={() => save(false, live.message)}>
                    Turn off
                  </Button>
                )}
                <Button variant="primary" loading={busy} disabled={!text.trim() || (live.active && text === live.message)} onClick={() => save(true, text.trim())}>
                  {live.active ? 'Update banner' : 'Publish banner'}
                </Button>
              </div>
            </Card>
          </div>

          <Card title="Recent broadcasts" padded={false} className="self-start">
            {!data?.history.length ? (
              <Empty title="Nothing sent yet" />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {data.history.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => setDraft(h.message)} className="w-full text-start px-4 py-2.5 hover:bg-zinc-50" title="Reuse this message">
                      <div className="text-sm text-zinc-800 line-clamp-2">{h.message}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {fmtDate(h.created_at, true)} · {h.active ? 'published' : 'saved off'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
