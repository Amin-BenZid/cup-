import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/hash'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const pin = (body.pin ?? '').toString().trim()

    if (!pin) {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    }

    const pin_hash = await hashPin(pin)

 const { data, error } = await supabaseAdmin
  .from('shops')
  .select('id, name, status')
  .eq('pin_hash', pin_hash)
  .maybeSingle()

if (data && data.status === 'disabled') {
  return NextResponse.json(
    { error: 'This shop has been disabled' },
    { status: 403 }
  )
}
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    return NextResponse.json({ shop: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 })
  }
}