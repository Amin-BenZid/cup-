import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/hash'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pin = (body?.pin ?? '').toString().trim()

    if (!pin) {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    }

    const pin_hash = await hashPin(pin)

    const { data, error } = await supabaseAdmin
      .from('shops')
      .select('id, name, status, trial_ends_at, subscription_ends_at')
      .eq('pin_hash', pin_hash)
      .limit(2)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
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

    // BILLING CHECK
    const now = new Date()
    const trialEnds = shop.trial_ends_at ? new Date(shop.trial_ends_at) : null
    const subEnds = shop.subscription_ends_at ? new Date(shop.subscription_ends_at) : null

    const isTrialExpired = trialEnds && now > trialEnds
    const isSubExpired = subEnds ? now > subEnds : true

    if (isTrialExpired && isSubExpired) {
      return NextResponse.json(
        { error: 'expired', status: 'expired' },
        { status: 403 }
      )
    }

    return NextResponse.json({ shop: { id: shop.id, name: shop.name } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}