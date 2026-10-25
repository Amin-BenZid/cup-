'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAdmin } from '@/components/admin/AdminShell'
import {
  adminFetch,
  Button,
  Card,
  cx,
  Empty,
  ErrorBanner,
  PageHeader,
  Pill,
  Skeleton,
  timeAgo,
  useAdminData,
} from '@/components/admin/ui'

type ClientError = {
  id?: string | number
  message: string
  stack: string | null
  url: string | null
  user_agent: string | null
  created_at?: string | null
}

type Group = { message: string; count: number; last: ClientError; urls: Set<string>; items: ClientError[] }

function path(url: string | null) {
  if (!url) return ''
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

export default function ErrorsPage() {
  const { toast, refreshBadges } = useAdmin()
  const { data, error, loading, reload } = useAdminData<{ errors: ClientError[] }>('/api/admin/errors')
  const [open, setOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  // Group identical messages so one bug doesn't fill the page.
  const groups = useMemo(() => {
    const m = new Map<string, Group>()
    for (const e of data?.errors ?? []) {
      const g = m.get(e.message)
      if (g) {
        g.count++
        g.items.push(e)
        if (e.url) g.urls.add(path(e.url))
      } else {
        m.set(e.message, { message: e.message, count: 1, last: e, urls: new Set(e.url ? [path(e.url)] : []), items: [e] })
      }
    }
    return [...m.values()]
  }, [data])

  async function clearAll() {
    setBusy(true)
    const r = await adminFetch('/api/admin/errors', { method: 'DELETE' })
    setBusy(false)
    setConfirm(false)
    if (!r.ok) return toast('error', r.data.error ?? 'Failed')
    toast('success', 'Errors cleared')
    refreshBadges()
    void reload()
  }

  return (
    <div>
      <PageHeader
        title="App errors"
        subtitle="Crashes reported by browsers (customers, baristas, admin)"
        actions={
          (data?.errors.length ?? 0) > 0 && (
            <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </Button>
          )
        }
      />
      <ErrorBanner message={error} onRetry={reload} />

      <Card padded={false}>
        {loading && !data ? (
          <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : groups.length === 0 ? (
          <Empty title="No errors 🎉" hint="When a page crashes, it shows up here." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {groups.map((g) => {
              const isOpen = open === g.message
              return (
                <li key={g.message}>
                  <button onClick={() => setOpen(isOpen ? null : g.message)} className="w-full flex items-start gap-3 px-4 py-3 text-start hover:bg-zinc-50">
                    <Pill className="bg-red-100 text-red-700 tabular-nums mt-0.5">×{g.count}</Pill>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 break-words">{g.message}</div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        {[...g.urls].slice(0, 3).join(', ') || 'unknown page'}
                        {g.last.created_at && ` · last ${timeAgo(g.last.created_at)}`}
                      </div>
                    </div>
                    <ChevronDown className={cx('w-4 h-4 text-zinc-400 mt-1 transition', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2">
                      {g.items.slice(0, 5).map((e, i) => (
                        <div key={i} className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs">
                          <div className="text-zinc-500 mb-1 break-all">
                            {e.url} {e.created_at && `· ${timeAgo(e.created_at)}`}
                          </div>
                          <div className="text-zinc-500 mb-2 break-all">{e.user_agent}</div>
                          {e.stack && <pre className="whitespace-pre-wrap break-all text-[11px] text-zinc-700 max-h-48 overflow-auto">{e.stack}</pre>}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={clearAll}
        loading={busy}
        title="Clear all errors?"
        description="Deletes every logged client error. New errors will keep being recorded."
        confirmLabel="Clear"
      />
    </div>
  )
}
