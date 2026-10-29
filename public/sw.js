// Beep service worker: push notifications + a small offline page.

// Take over right away when a new version ships (nothing is cached, so it's safe).
self.addEventListener('install', function () {
  self.skipWaiting()
})
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// Page loads only (never API calls or live updates): if the network is down,
// show a friendly page instead of the browser's error. Browsers also need
// this to offer the one-tap "Install app" prompt.
const OFFLINE_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beep</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#faf7f2;color:#1c1917;font:16px/1.5 system-ui,-apple-system,sans-serif;text-align:center;padding:24px}
.c{max-width:320px}.l{width:56px;height:56px;border-radius:16px;background:#1d1916;margin:0 auto 16px}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0;color:#78716c}
button{margin-top:18px;border:0;border-radius:14px;background:#1c1917;color:#fefce8;font-weight:600;padding:12px 22px;font-size:15px}</style></head>
<body><div class="c"><div class="l"></div><h1>Pas de connexion · No connection</h1><p>Vérifiez internet puis réessayez.</p><p dir="rtl">لا يوجد اتصال. تحقق من الإنترنت ثم أعد المحاولة.</p><p>Check your internet and try again.</p>
<button onclick="location.reload()">↻</button></div></body></html>`

self.addEventListener('fetch', function (event) {
  const req = event.request
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  event.respondWith(
    fetch(req).catch(function () {
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    })
  )
})

self.addEventListener('push', function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Order ready', body: 'Your order is ready.' }
  }

  const title = data.title || 'Order ready'
  const options = {
    body: data.body || 'Pick it up at the counter.',
    icon: '/icon-192.png',
    // Monochrome mark: Android shows the badge as a silhouette in the status bar.
    badge: '/badge-96.png',
    tag: data.tag || 'order-ready',
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500],
    data: { url: data.url || '/' },
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Show "1" on the app icon
      self.navigator.setAppBadge
        ? self.navigator.setAppBadge(1).catch(() => {})
        : Promise.resolve(),
    ])
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  // Clear the badge
  event.waitUntil(
    Promise.all([
      self.navigator.clearAppBadge
        ? self.navigator.clearAppBadge().catch(() => {})
        : Promise.resolve(),
      (async () => {
        const path =
          (event.notification.data && event.notification.data.url) || '/'
        // Compare absolute URLs (client.url is always absolute).
        const url = new URL(path, self.location.origin).href
        const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const c of clientList) {
          if (c.url === url && 'focus' in c) return c.focus()
        }
        if (clients.openWindow) return clients.openWindow(url)
      })(),
    ])
  )
})