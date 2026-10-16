import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase-admin'

let configured = false

function configure() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:test@example.com'

  if (!publicKey || !privateKey) {
    console.error('VAPID keys missing — push will fail')
    return
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export async function sendOrderReadyPush(orderId: string) {
  configure()

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .eq('order_id', orderId)

  if (!subs || subs.length === 0) return

  const payload = JSON.stringify({
    title: 'Your order is ready',
    body: 'Pick it up at the counter',
    url: `/o/${orderId}`,
  })

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        // 404/410 = subscription expired → remove it
        if (status === 404 || status === 410) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', row.subscription.endpoint)
        } else {
          console.error('Push send failed:', err)
        }
      }
    })
  )
}