import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/hash'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = (body?.name ?? '').toString().trim()
    const pin = (body?.pin ?? '').toString()

    if (!name) {
      return NextResponse.json({ error: 'Shop name required' }, { status: 400 })
    }
    if (pin.length < 4 || pin.length > 6) {
      return NextResponse.json(
        { error: 'PIN must be 4–6 digits' },
        { status: 400 }
      )
    }

   const pin_hash = await hashPin(pin)

// Reject if another shop already uses this PIN
const { data: existing } = await supabaseAdmin
  .from('shops')
  .select('id')
  .eq('pin_hash', pin_hash)
  .limit(1)

if (existing && existing.length > 0) {
  return NextResponse.json(
    { error: 'This PIN is already taken. Please choose another.' },
    { status: 409 }
  )
}

const { data, error } = await supabaseAdmin
  .from('shops')
  .insert({
    name,
    pin_hash,
    status: 'pending',
  })
  .select('id, name, status')
  .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ shop: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}