import CustomerOrderClient from './client'
import { getPublicOrder } from '@/lib/public-order'
import type { Shop } from '@/lib/themes'
import { orderTopic } from '@/lib/realtime'

export const dynamic = 'force-dynamic'

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Render the order and shop branding on the server so the customer sees
  // their page on first paint instead of a loader + a second request.
  // On a transient DB error, pass nothing and let the client fetch instead.
  let result: Awaited<ReturnType<typeof getPublicOrder>> | null = null
  try {
    result = await getPublicOrder(id)
  } catch {
    result = null
  }

  if (result?.ok) {
    return (
      <CustomerOrderClient
        orderId={id}
        initialOrder={result.order}
        initialShop={result.shop as unknown as Shop | null}
        topic={orderTopic(id)}
      />
    )
  }

  if (result && result.notFound) {
    return <CustomerOrderClient orderId={id} initialOrder={null} initialShop={null} />
  }

  return <CustomerOrderClient orderId={id} />
}
