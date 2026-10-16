import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/hash'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = (body.name ?? '').toString().trim()
    const pin = (body.pin ?? '').toString()

    if (!name) return NextResponse.json({ error: 'Shop name required' }, { status: 400 })
    if (pin.length < 4 || pin.length > 6)
      return NextResponse.json({ error: 'PIN must be 4–6 digits' }, { status: 400 })

    const pin_hash = await hashPin(pin)

    const { data, error } = await supabaseAdmin
      .from('shops')
      .insert({ name, pin_hash })
      .select('id, name')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ shop: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}