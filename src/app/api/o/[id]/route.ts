import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const PUBLIC_SHOP_FIELDS =
  'id, name, tagline, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await ctx.params
    const id = resolved?.id

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(
        'id, shop_id, order_number, status, created_at, ready_at, customer_connected'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[o/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select(PUBLIC_SHOP_FIELDS)
      .eq('id', order.shop_id)
      .maybeSingle()

    return NextResponse.json(
      { order, shop: shop ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}