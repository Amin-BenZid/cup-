export type Shop = {
  id: string
  name: string
  pin_hash: string
  created_at: string
}

export type Order = {
  id: string
  shop_id: string
  order_number: string
  status: 'preparing' | 'ready' | 'done'
  customer_connected: boolean
  created_at: string
  ready_at: string | null
}