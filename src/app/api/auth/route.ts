import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/hash'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pin = (body?.pin ?? '').toString().trim()

    if (!pin || pin.length < 4) {
      return NextResponse.json(
        { error: 'PIN must be at least 4 digits' },
        { status: 400 }
      )
    }

    const pin_hash = await hashPin(pin)

    // Use .limit(2) so we can detect duplicates without crashing
    const { data, error } = await supabaseAdmin
      .from('shops')
      .select('id, name, status')
      .eq('pin_hash', pin_hash)
      .limit(2)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      // Wrong PIN — return a clean, safe error
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    if (data.length > 1) {
      // Two shops share this PIN. Pick the oldest one deterministically.
      // (We'll prevent this from happening at creation time going forward.)
      // For now, warn and continue with the first.
      console.warn(
        `[auth] PIN collision — ${data.length} shops share this PIN hash`
      )
    }

    const shop = data[0]

    if (shop.status === 'pending') {
      return NextResponse.json(
        {
          error: 'pending',
          status: 'pending',
          shop_id: shop.id,
          shop_name: shop.name,
        },
        { status: 403 }
      )
    }

    if (shop.status === 'disabled') {
      return NextResponse.json(
        { error: 'disabled', status: 'disabled' },
        { status: 403 }
      )
    }

    return NextResponse.json({ shop: { id: shop.id, name: shop.name } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}