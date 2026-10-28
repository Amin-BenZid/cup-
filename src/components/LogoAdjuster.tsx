'use client'

import { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import Logo from './Logo'
import { useT } from '@/lib/i18n/context'

type Props = {
  url: string
  name: string
  scale: number
  offsetX: number
  offsetY: number
  onChange: (next: { scale: number; offsetX: number; offsetY: number }) => void
}

export default function LogoAdjuster({
  url,
  name,
  scale,
  offsetX,
  offsetY,
  onChange,
}: Props) {
  const t = useT()
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{
    x: number
    y: number
    ox: number
    oy: number
  } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !dragStart) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100
    onChange({
      scale,
      offsetX: dragStart.ox + dx,
      offsetY: dragStart.oy + dy,
    })
  }

  function onPointerUp() {
    setDragging(false)
    setDragStart(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div
          className="w-24 h-24 rounded-2xl overflow-hidden border border-stone-200 bg-stone-50 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Logo
            url={url}
            name={name}
            size={96}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
            radius={16}
          />
        </div>

        <div className="flex-1 space-y-3">
          <div className="text-xs text-stone-500">
            {t('logo.drag')}
          </div>

          <div className="flex items-center gap-2">
            <ZoomOut className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.01}
              value={scale}
              onChange={(e) =>
                onChange({
                  scale: parseFloat(e.target.value),
                  offsetX,
                  offsetY,
                })
              }
              className="w-full accent-stone-900"
            />
            <ZoomIn className="w-4 h-4 text-stone-400 shrink-0" />
            <span className="text-xs tabular-nums text-stone-500 w-10 text-right">
              {scale.toFixed(2)}×
            </span>
          </div>

          <button
            onClick={() => onChange({ scale: 1, offsetX: 0, offsetY: 0 })}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('logo.reset')}
          </button>
        </div>
      </div>
    </div>
  )
}