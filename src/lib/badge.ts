/**
 * Wrappers around the App Badging API.
 * On Android Chrome + iOS Safari (installed PWA), these put a small badge
 * on the app icon on the home screen.
 * On unsupported browsers, they no-op silently.
 */

export function setBadge(count?: number) {
  if (typeof navigator === 'undefined') return
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
  }
  if (!nav.setAppBadge) return
  try {
    if (typeof count === 'number') {
      nav.setAppBadge(count).catch(() => {})
    } else {
      nav.setAppBadge().catch(() => {})
    }
  } catch {}
}

export function clearBadge() {
  if (typeof navigator === 'undefined') return
  const nav = navigator as Navigator & {
    clearAppBadge?: () => Promise<void>
  }
  if (!nav.clearAppBadge) return
  try {
    nav.clearAppBadge().catch(() => {})
  } catch {}
}
