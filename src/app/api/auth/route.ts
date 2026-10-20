import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/hash'
import { SHOP_COOKIE, SHOP_MAX_AGE, createShopToken } from "@/lib/shop-auth";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = (body?.code ?? '').toString().trim().toLowerCase()
    const pin = (body?.pin ?? '').toString().trim()

    if (!code || !pin) {
      return NextResponse.json({ error: 'Code and PIN required' }, { status: 400 })
    }

    // 1. Fetch the shop by code
    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .select('id, name, status, code, pin_hash, trial_ends_at, subscription_ends_at, login_attempts, locked_until')
      .eq('code', code)
      .maybeSingle()

    if (error || !shop) {
      return NextResponse.json({ error: 'Invalid Café Code or PIN' }, { status: 401 })
    }

    // 2. Check if locked out (5 failed attempts = 15 min lock)
    if (shop.locked_until && new Date(shop.locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }

    // 3. Verify PIN
    const pin_hash = await hashPin(pin)
    if (pin_hash !== shop.pin_hash) {
      // Increment failed attempts
      const attempts = (shop.login_attempts || 0) + 1
      let locked_until = null
      
      if (attempts >= 5) {
        locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }

      await supabaseAdmin
        .from('shops')
        .update({ login_attempts: attempts, locked_until })
        .eq('id', shop.id)

      return NextResponse.json({ error: 'Invalid Café Code or PIN' }, { status: 401 })
    }

    // 4. Reset attempts on success
    if (shop.login_attempts > 0 || shop.locked_until) {
      await supabaseAdmin
        .from('shops')
        .update({ login_attempts: 0, locked_until: null })
        .eq('id', shop.id)
    }

    // 5. Check shop status
    if (shop.status === 'pending') {
      return NextResponse.json(
        { error: 'pending', status: 'pending', shop_id: shop.id, shop_name: shop.name },
        { status: 403 }
      )
    }
    if (shop.status === 'disabled') {
      return NextResponse.json(
        { error: 'disabled', status: 'disabled' },
        { status: 403 }
      )
    }

    // 6. Billing Check
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

    const res = NextResponse.json({
      shop: { id: shop.id, name: shop.name, code: shop.code },
    });

    res.cookies.set({
      name: SHOP_COOKIE,
      value: createShopToken(shop.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SHOP_MAX_AGE,
      path: "/",
    });

    return res;  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}