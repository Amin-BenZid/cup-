'use client'

import { useEffect, useState } from 'react'

/**
 * Returns the elapsed time in seconds since `startIso`.
 * If `endIso` is provided, the timer stops at that moment.
 * Returns null until both dates are valid.
 */
export function useElapsed(startIso: string | null, endIso?: string | null) {
  const [elapsed, setElapsed] = useState<number | null>(null)
  const start = startIso ? new Date(startIso).getTime() : NaN
  const valid = Number.isFinite(start)

  useEffect(() => {
    if (!valid) return
    const end = endIso ? new Date(endIso).getTime() : null
    const compute = () => {
      const now = end ?? Date.now()
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)))
    }
    // First value right away (as a timer callback), then every second unless
    // there's an end time.
    const first = setTimeout(compute, 0)
    if (end) return () => clearTimeout(first)
    const id = setInterval(compute, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [valid, start, endIso])

  return valid ? elapsed : null
}

/** Formats seconds as "3m 12s" / "45s" / "1h 3m" */
export function formatElapsed(total: number | null): string {
  if (total == null) return '—'
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${mm.toString().padStart(2, '0')}m`
}