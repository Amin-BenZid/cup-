self.addEventListener('push', function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Order ready', body: 'Your coffee is ready.' }
  }

  const title = data.title || 'Order ready'
  const options = {
    body: data.body || 'Your coffee is waiting at the counter.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
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