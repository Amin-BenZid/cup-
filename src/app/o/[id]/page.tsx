import CustomerOrderClient from './client'

export const dynamic = 'force-dynamic'

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CustomerOrderClient orderId={id} />
}