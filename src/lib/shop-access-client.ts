'use client'

/**
 * What the staff app does when the server refuses a request (401/403):
 * ask /api/auth/session for the café's real state and go to the screen that
 * explains it. One place, so every page tells the same, correct story.
 */

export type AccessState =
  | 'ok'
  | 'pending'
  | 'expired'
  | 'disabled'
  | 'archived'
  | 'deleted'
  | 'signed_out'

export type AccessInfo = {
  state: AccessState
  reason: 'trial' | 'subscription' | null
  shop: { id: string; name: string } | null
}

type Router = { replace: (href: string) => void }

const KEYS = ['shop_id', 'shop_name', 'shop_code', 'shop_expired_reason'] as const

export function clearShopStorage() {
  try {
    for (const k of KEYS) localStorage.removeItem(k)
  } catch {}
}

/** null = couldn't reach the server (network); never guess a state then. */
export async function fetchAccess(): Promise<AccessInfo | null> {
  try {
    const res = await fetch('/api/auth/session', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    const state = (json?.state ?? (res.status === 401 ? 'signed_out' : null)) as AccessState | null
    if (!state) return null
    return {
      state,
      reason: json?.reason === 'subscription' ? 'subscription' : json?.reason === 'trial' ? 'trial' : null,
      shop: json?.shop?.id ? { id: json.shop.id, name: json.shop.name ?? '' } : null,
    }
  } catch {
    return null
  }
}

/** Where a state lives in the app. */
export function screenFor(state: AccessState): string | null {
  switch (state) {
    case 'ok':
      return null
    case 'signed_out':
      return '/barista'
    case 'pending':
      return '/pending'
    case 'deleted':
      return '/expired?state=deleted'
    default:
      return '/expired'
  }
}

/**
 * Call after a 401/403. Returns true if it navigated away (the caller should
 * stop), false if access is actually fine (e.g. a one-off error).
 */
// Several requests can fail at the same moment (orders, support, ...). They
// share one check, and once the café is known to be deleted that answer
// sticks for a few seconds: the check clears the cookie, so a second check would only say
// "signed out" and send the café to the login screen instead.
let inflight: Promise<AccessInfo | null> | null = null
let deletedAt = 0
const DELETED_MEMORY_MS = 10_000

async function checkOnce(): Promise<AccessInfo | null> {
  if (Date.now() - deletedAt < DELETED_MEMORY_MS) return { state: 'deleted', reason: null, shop: null }
  if (!inflight) {
    inflight = fetchAccess().then((info) => {
      if (info?.state === 'deleted') deletedAt = Date.now()
      return info
    })
    void inflight.finally(() => {
      setTimeout(() => {
        inflight = null
      }, 2000)
    })
  }
  return inflight
}

export async function handleAccessDenied(router: Router): Promise<boolean> {
  const info = await checkOnce()
  if (!info) return false
  if (info.state === 'signed_out' || info.state === 'deleted') clearShopStorage()
  if (info.shop?.name) {
    try {
      localStorage.setItem('shop_name', info.shop.name)
    } catch {}
  }
  const href = screenFor(info.state)
  if (!href) return false
  router.replace(href)
  return true
}
