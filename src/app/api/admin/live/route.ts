import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  // Fetch latest orders across ALL shops
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      created_at,
      ready_at,
      customer_connected,
      shop_id,
      shops (
        name,
        logo_url
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { orders: orders ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}