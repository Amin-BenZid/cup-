'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, ZoomIn, ZoomOut, Check, ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { handleAccessDenied } from '@/lib/shop-access-client'
import { useT } from '@/lib/i18n/context'
import { apiErrorText } from '@/lib/i18n/api-error'

const OUTPUT_SIZE = 512

type Props = {
  currentUrl: string | null
  onUploaded: (url: string) => void
  shopId: string
}

export default function LogoUploader({
  currentUrl,
  onUploaded,
  shopId,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [showCrop, setShowCrop] = useState(false)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const t = useT()
  const [error, setError] = useState('')

  const fileRef = useRef<HTMLInputElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    ox: number
    oy: number
  }>({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 })

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

  const reset = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setShowCrop(false)
    setError('')
  }, [preview])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(
        file.type
      )
    ) {
      setError(t('logo.error.type'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('logo.error.size'))
      return
    }

    const url = URL.createObjectURL(file)
    setPreview(url)
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setShowCrop(true)
    setError('')

    if (fileRef.current) fileRef.current.value = ''
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        ox: offset.x,
        oy: offset.y,
      }
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
      }
      dragRef.current.active = false
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointers.current.values())
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const next = Math.max(
        0.3,
        Math.min(4, pinchRef.current.scale * (d / pinchRef.current.dist))
      )
      setScale(next)
      return
    }

    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    if (pointers.current.size === 0) dragRef.current.active = false
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.002
    setScale((s) => Math.max(0.3, Math.min(4, s + delta)))
  }

  const apply = useCallback(async () => {
    const img = imgRef.current
    if (!img || !preview) return
    const frame = img.parentElement
    if (!frame) return
    const frameRect = frame.getBoundingClientRect()
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight
    const frameSize = frameRect.width

    const fitScale = Math.min(frameSize / naturalW, frameSize / naturalH)
    const totalScale = fitScale * scale
    const drawW = naturalW * totalScale
    const drawH = naturalH * totalScale
    const drawX = (frameSize - drawW) / 2 + offset.x
    const drawY = (frameSize - drawH) / 2 + offset.y
    const sx = (0 - drawX) / totalScale
    const sy = (0 - drawY) / totalScale
    const sw = frameSize / totalScale
    const sh = frameSize / totalScale

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92)
    )
    if (!blob) {
      setError(t('logo.error.process'))
      return
    }

    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', new File([blob], 'logo.png', { type: 'image/png' }))
      const res = await fetch(`/api/shops/${shopId}/logo`, {
        method: 'POST',
        body: form,
      })
      if ((res.status === 401 || res.status === 403) && (await handleAccessDenied(router))) return
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(apiErrorText(t, json, 'logo.error.upload'))
        return
      }
      onUploaded(json.logo_url)
      reset()
    } catch {
      setError(t('logo.error.upload'))
    } finally {
      setUploading(false)
    }
  }, [preview, scale, offset, shopId, onUploaded, router, t, reset])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  return (
    <>
      <div className="flex items-center gap-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={t('cz.branding.logo')}
            className="w-14 h-14 rounded-xl object-cover border border-stone-200"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-stone-100 border border-dashed border-stone-300 flex items-center justify-center text-stone-400">
            <ImageIcon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={onPick}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-300 text-sm font-medium hover:bg-stone-50 transition"
        >
          <Upload className="w-3.5 h-3.5" />
          {currentUrl ? 'Replace' : 'Upload'}
        </button>
        {error && !showCrop && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>

      {showCrop && preview && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !uploading && reset()}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
              <div>
                <div className="text-sm font-semibold">{t('logo.adjustTitle')}</div>
                <div className="text-xs text-stone-500">
                  Drag to move · pinch or scroll to zoom
                </div>
              </div>
              <button
                onClick={() => !uploading && reset()}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition"
                aria-label={t('qr.close')}
              >
                <X className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            <div className="p-5">
              <div
                className="relative aspect-square w-full overflow-hidden rounded-full bg-stone-100 cursor-grab active:cursor-grabbing touch-none select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={preview}
                  alt={t('logo.adjustTitle')}
                  draggable={false}
                  className="absolute inset-0 w-full h-full pointer-events-none select-none"
                  style={{
                    objectFit: 'contain',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: 'center center',
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-stone-900/10" />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="range"
                  min={0.3}
                  max={4}
                  step={0.01}
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-stone-900"
                />
                <ZoomIn className="w-4 h-4 text-stone-400 shrink-0" />
              </div>

              {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            </div>

            <div className="flex items-center gap-2 px-5 pb-5">
              <button
                onClick={() => !uploading && reset()}
                disabled={uploading}
                className="flex-1 py-3 rounded-xl border border-stone-300 text-sm font-medium hover:bg-stone-50 disabled:opacity-50 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={apply}
                disabled={uploading}
                className="flex-1 py-3 rounded-xl bg-stone-900 text-amber-50 text-sm font-semibold hover:bg-stone-800 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
              >
                {uploading ? (
                  'Uploading…'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {t('logo.use')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}