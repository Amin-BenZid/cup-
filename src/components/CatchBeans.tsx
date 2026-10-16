'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'

type Bean = {
  id: number
  x: number
  y: number
  vy: number
  rot: number
  vrot: number
}

const BEST_KEY = 'catch-beans-best'
const CUP_WIDTH = 22
const CATCH_LINE = 82
const LIVES = 3

export default function CatchBeans() {
  const [playing, setPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState(0)
  const [beans, setBeans] = useState<Bean[]>([])
  const [best, setBest] = useState(0)
  const [cupX, setCupX] = useState(50)

  const beanId = useRef(0)
  const raf = useRef<number | null>(null)
  const last = useRef(0)
  const spawnAcc = useRef(0)
  const speed = useRef(1)
  const cupTarget = useRef(50)
  const cupRender = useRef(50)
  const areaRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)
  const playingRef = useRef(false)
  const bestRef = useRef(0)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    const saved = Number(localStorage.getItem(BEST_KEY) ?? '0')
    if (!isNaN(saved)) {
      setBest(saved)
      bestRef.current = saved
    }
  }, [])

  const moveCup = useCallback((clientX: number) => {
    const area = areaRef.current
    if (!area) return
    const rect = area.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    cupTarget.current = Math.max(CUP_WIDTH / 2, Math.min(100 - CUP_WIDTH / 2, pct))
  }, [])

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    moveCup(e.clientX)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!playingRef.current) return
    if (e.pointerType === 'mouse' || dragging.current) moveCup(e.clientX)
  }
  const onUp = () => {
    dragging.current = false
  }

  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')
        cupTarget.current = Math.max(CUP_WIDTH / 2, cupTarget.current - 6)
      if (e.key === 'ArrowRight')
        cupTarget.current = Math.min(100 - CUP_WIDTH / 2, cupTarget.current + 6)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing])

  const endGame = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setGameOver(true)
  }, [])

  const start = useCallback(() => {
    setScore(0)
    setMisses(0)
    setBeans([])
    setGameOver(false)
    setPlaying(true)
    playingRef.current = true
    speed.current = 1
    spawnAcc.current = 0
    beanId.current = 0
    last.current = performance.now()
  }, [])

  useEffect(() => {
    if (!playing) return
    let cancelled = false

    const loop = (now: number) => {
      if (cancelled) return
      const dtMs = Math.min(50, now - last.current)
      last.current = now
      const dt = dtMs / 1000

      const ease = 1 - Math.pow(0.0001, dt)
      cupRender.current += (cupTarget.current - cupRender.current) * ease
      setCupX(cupRender.current)

      speed.current = Math.min(3.2, speed.current + dt * 0.03)

      spawnAcc.current += dtMs
      const interval = Math.max(420, 950 - speed.current * 120)
      if (spawnAcc.current >= interval) {
        spawnAcc.current = 0
        const id = beanId.current++
        setBeans((prev) => [
          ...prev,
          {
            id,
            x: 10 + Math.random() * 80,
            y: -6,
            vy: (26 + Math.random() * 10) * speed.current,
            rot: Math.random() * 360,
            vrot: (Math.random() - 0.5) * 90,
          },
        ])
      }

      setBeans((prev) => {
        const next: Bean[] = []
        let missed = 0
        const center = cupRender.current
        const half = CUP_WIDTH / 2

        for (const b of prev) {
          const ny = b.y + b.vy * dt
          const hit = ny >= CATCH_LINE && b.x >= center - half && b.x <= center + half

          if (hit) {
            setScore((s) => {
              const ns = s + 1
              if (ns > bestRef.current) {
                bestRef.current = ns
                setBest(ns)
                localStorage.setItem(BEST_KEY, String(ns))
              }
              return ns
            })
            continue
          }
          if (ny > 108) {
            missed++
            continue
          }
          next.push({ ...b, y: ny, rot: b.rot + b.vrot * dt })
        }

        if (missed > 0) {
          setMisses((m) => {
            const nm = m + missed
            if (nm >= LIVES && playingRef.current) setTimeout(endGame, 0)
            return Math.min(nm, LIVES)
          })
        }
        return next
      })

      raf.current = requestAnimationFrame(loop)
    }

    raf.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [playing, endGame])

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="font-medium">Score</span>
          <span className="font-semibold text-stone-900 tabular-nums">
            {score}
          </span>
          <span className="text-stone-300">·</span>
          <span>
            Best <span className="text-stone-700 tabular-nums">{best}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: LIVES }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < LIVES - misses ? 'bg-stone-800' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* PLAY AREA */}
      <div
        ref={areaRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-72 sm:h-80 overflow-hidden touch-none select-none bg-[#fbf9f6]"
        style={{
          touchAction: 'none',
          cursor: playing ? 'none' : 'default',
          backgroundImage:
            'radial-gradient(circle at 50% 120%, rgba(217,119,6,0.06), transparent 60%)',
        }}
      >
        {/* Counter line */}
        <div className="absolute left-0 right-0 bottom-0 h-px bg-stone-200" />
        <div className="absolute left-0 right-0 bottom-0 h-16 bg-gradient-to-t from-stone-100/70 to-transparent pointer-events-none" />

        {/* Beans */}
        {playing &&
          beans.map((b) => (
            <div
              key={b.id}
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 will-change-transform"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
              }}
            >
              <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-sm">
                <ellipse
                  cx="12"
                  cy="12"
                  rx="8"
                  ry="10"
                  transform="rotate(20 12 12)"
                  fill="#3f2a1a"
                />
                <path
                  d="M7 7 Q12 12 9 18"
                  stroke="#8a5a37"
                  strokeWidth="1.4"
                  fill="none"
                  transform="rotate(20 12 12)"
                />
              </svg>
            </div>
          ))}

        {/* Cup */}
        <div
          className="absolute bottom-2 -translate-x-1/2 pointer-events-none will-change-transform"
          style={{ left: `${cupX}%`, width: `${CUP_WIDTH}%` }}
        >
          <svg viewBox="0 0 100 66" className="w-full h-auto">
            {/* handle */}
            <path
              d="M78 22 Q96 22 96 36 Q96 50 78 50"
              fill="none"
              stroke="#1c1917"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* body */}
            <path
              d="M6 14 L94 14 L86 58 Q85 64 78 64 L22 64 Q15 64 14 58 Z"
              fill="#1c1917"
            />
            {/* rim */}
            <rect x="2" y="10" width="96" height="8" rx="4" fill="#0c0a09" />
            {/* highlight */}
            <rect
              x="10"
              y="12"
              width="26"
              height="2"
              rx="1"
              fill="#ffffff"
              opacity="0.12"
            />
          </svg>
        </div>

        {/* Start overlay */}
        {!playing && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="text-xs text-stone-500 text-center px-8">
              Drag to move the cup. Catch the beans, miss three and it&apos;s over.
            </p>
            <button
              onClick={start}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition"
            >
              <Play className="w-3.5 h-3.5" />
              Play
            </button>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider text-stone-500">
                Final score
              </p>
              <p className="text-3xl font-semibold text-stone-900 tabular-nums">
                {score}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {score === best && score > 0 ? 'New best' : `Best ${best}`}
              </p>
            </div>
            <button
              onClick={start}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 text-stone-800 text-sm font-medium hover:bg-stone-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Play again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}