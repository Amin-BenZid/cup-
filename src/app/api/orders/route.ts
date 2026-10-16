import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const shop_id = (body?.shop_id ?? '').toString()
    const order_number = (body?.order_number ?? '').toString().trim()

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
    }
    if (!order_number) {
      return NextResponse.json(
        { error: 'order_number required' },
        { status: 400 }
      )
    }

    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('id', shop_id)
      .maybeSingle()

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({ shop_id, order_number, status: 'preparing' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ order: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}