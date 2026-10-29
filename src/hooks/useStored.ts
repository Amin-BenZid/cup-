'use client'

import { useSyncExternalStore } from 'react'

/**
 * Browser-only values (localStorage, "are we in the browser yet") read the way
 * React wants: no setState in an effect, and the server render plus hydration
 * see `null` / `false`, so there's no mismatch.
 */

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

/** Call after writing localStorage in this tab so readers update. */
export function storageChanged() {
  listeners.forEach((l) => l())
}

/** A localStorage value, or null on the server / when unavailable. */
export function useStored(key: string | null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!key) return null
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null,
  )
}

const noop = () => () => {}

/** false during the server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}

/**
 * True while a "Later" pressed less than `ms` ago is in effect: localStorage
 * `key` holds the timestamp it was pressed.
 */
export function useSnoozed(key: string | null, ms: number): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!key) return false
      try {
        return Date.now() - Number(localStorage.getItem(key) ?? 0) < ms
      } catch {
        return false
      }
    },
    () => false,
  )
}
