'use client'

import { useEffect } from 'react'
import { Check, AlertCircle, Info, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

export function Toast({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  const styles = {
    success: {
      icon: <Check className="w-4 h-4" />,
      cls: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      iconCls: 'bg-emerald-100 text-emerald-600',
    },
    error: {
      icon: <AlertCircle className="w-4 h-4" />,
      cls: 'bg-red-50 border-red-200 text-red-800',
      iconCls: 'bg-red-100 text-red-600',
    },
    info: {
      icon: <Info className="w-4 h-4" />,
      cls: 'bg-stone-50 border-stone-200 text-stone-800',
      iconCls: 'bg-stone-100 text-stone-600',
    },
  }[toast.kind]

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur ${styles.cls}`}
    >
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${styles.iconCls}`}
      >
        {styles.icon}
      </div>
      <p className="text-sm flex-1 min-w-0">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-black/5 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}