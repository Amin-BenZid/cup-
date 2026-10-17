import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const order_id = (body?.order_id ?? '').toString()
    const rating = Number(body?.rating)
    const comment = (body?.comment ?? '').toString().trim().slice(0, 200)

    if (!order_id) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }
    if (![1, 2, 3].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
    }

    // Look up the order to get the shop_id
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, shop_id, status')
      .eq('id', order_id)
      .maybeSingle()

    if (orderErr) {
      return NextResponse.json({ error: orderErr.message }, { status: 500 })
    }
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.status !== 'ready' && order.status !== 'done') {
      return NextResponse.json(
        { error: 'Order not yet ready' },
        { status: 400 }
      )
    }

    // Upsert — if the customer already reviewed, update their rating
    const { error } = await supabaseAdmin.from('reviews').upsert(
      {
        order_id,
        shop_id: order.shop_id,
        rating,
        comment: comment || null,
      },
      { onConflict: 'order_id' }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}