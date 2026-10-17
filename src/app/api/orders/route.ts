import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const shop_id = (body?.shop_id ?? '').toString()
    const order_number = (body?.order_number ?? '').toString().trim()
    const rawPhone = (body?.customer_phone ?? '').toString().trim()

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
    }
    if (!order_number) {
      return NextResponse.json(
        { error: 'order_number required' },
        { status: 400 }
      )
    }

    // Normalize phone: strip spaces, dashes, parentheses
    // Keep leading + if present
    let customer_phone: string | null = null
    if (rawPhone) {
      const cleaned = rawPhone.replace(/[\s\-().]/g, '')
      // Basic sanity check — 6 to 20 chars, digits and optional leading +
      if (/^\+?\d{6,20}$/.test(cleaned)) {
        customer_phone = cleaned
      } else {
        return NextResponse.json(
          { error: 'Invalid phone number' },
          { status: 400 }
        )
      }
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
      .insert({
        shop_id,
        order_number,
        status: 'preparing',
        customer_phone,
      })
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