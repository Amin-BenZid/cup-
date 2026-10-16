'use client'

import { Loader2, AlertTriangle } from 'lucide-react'
import Modal from './Modal'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: Props) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onClose}>
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              variant === 'danger'
                ? 'bg-red-100 text-red-600'
                : 'bg-stone-100 text-stone-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="text-sm font-semibold text-stone-900">
              {title}
            </div>
            {description && (
              <div className="text-xs text-stone-500 mt-1">
                {description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition inline-flex items-center justify-center gap-2 ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-stone-900 hover:bg-stone-800'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}