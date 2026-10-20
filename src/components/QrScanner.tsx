'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

export default function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void
  onClose: () => void
}) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return

        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        tick()
      } catch {
        setError(t('scan.error'))
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const vw = video.videoWidth
        const vh = video.videoHeight

        if (vw && vh) {
          // Downscale: decoding a 640px frame is ~10x faster than full res.
          const width = 640
          const height = Math.round((vh / vw) * width)
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height)
            const image = ctx.getImageData(0, 0, width, height)
            const code = jsQR(image.data, width, height, {
              inversionAttempts: 'dontInvert',
            })

            if (code?.data) {
              onResult(code.data)
              return
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [onResult, t])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 text-white">
        <div className="text-sm font-semibold">{t('scan.button')}</div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border-2 border-white/80 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>

        {error && (
          <div className="absolute inset-x-5 bottom-8 rounded-xl bg-red-500/90 text-white text-sm px-4 py-3">
            {error}
          </div>
        )}

        {!error && (
          <div className="absolute inset-x-0 bottom-10 text-center text-white/80 text-xs px-8">
            {t('scan.hint')}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}