'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  maxWidth?: number
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 420,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full shadow-2xl overflow-hidden"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && (
                <div className="text-base font-semibold text-stone-900">
                  {title}
                </div>
              )}
              {description && (
                <div className="text-sm text-stone-500 mt-1">
                  {description}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition shrink-0 -mr-1 -mt-1"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-stone-500" />
            </button>
          </div>
        )}
        <div className={title || description ? '' : 'pt-5'}>{children}</div>
      </div>
    </div>
  )
}