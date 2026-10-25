import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'
import { hashPin } from '@/lib/pin'

const SHOP_FIELDS =
  'id, name, tagline, status, created_at, code, phone, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages, trial_ends_at, subscription_ends_at, billing_status, paid_current_month, login_attempts, locked_until'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  const { data: shop, error } = await supabaseAdmin
    .from('shops')
    .select(SHOP_FIELDS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!shop) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, created_at, ready_at')
    .eq('shop_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: reviews } = await supabaseAdmin
    .from('reviews')
    .select('rating, comment, created_at')
    .eq('shop_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: history } = await supabaseAdmin
    .from('shop_history')
    .select('id, action, details, created_at')
    .eq('shop_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const reviewCount = reviews?.length ?? 0
  const ratingSum = (reviews ?? []).reduce((s, r) => s + r.rating, 0)
  const avgRating = reviewCount > 0 ? ratingSum / reviewCount : 0

  // Derived: the raw `status` column never becomes "expired".
  const now = Date.now()
  const trialEnd = shop.trial_ends_at
    ? new Date(shop.trial_ends_at).getTime()
    : 0
  const subEnd = shop.subscription_ends_at
    ? new Date(shop.subscription_ends_at).getTime()
    : 0

  const trialOk = trialEnd > now
  const subOk = subEnd > now

  let state: 'pending' | 'active' | 'expired' | 'disabled' = 'active'
  if (shop.status === 'pending') state = 'pending'
  else if (shop.status === 'disabled') state = 'disabled'
  else if (!trialOk && !subOk) state = 'expired'

  const daysLeft = Math.max(
    0,
    Math.ceil((Math.max(trialEnd, subEnd) - now) / 86400000)
  )

  return NextResponse.json({
    shop: {
      ...shop,
      state,
      days_left: daysLeft,
      is_trial: !subOk && trialOk,
    },
    orders: orders ?? [],
    reviews: reviews ?? [],
    history: history ?? [],
    reviewStats: {
      count: reviewCount,
      average: Math.round(avgRating * 10) / 10,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  let logAction = ''
  let logDetails: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    update.name = body.name.trim()
    logAction = 'renamed'
    logDetails = { new_name: body.name.trim() }
  }

  if (typeof body.status === 'string') {
    if (!['pending', 'active', 'disabled'].includes(body.status)) {
      return NextResponse.json({ error: 'Bad status' }, { status: 400 })
    }
    update.status = body.status
    logAction = body.status === 'active' ? 'approved' : 'disabled'
  }

  if (typeof body.new_pin === 'string') {
    // Login requires exactly 6 digits — anything else locks the shop out.
    if (!/^\d{6}$/.test(body.new_pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits' },
        { status: 400 }
      )
    }
    update.pin_hash = await hashPin(body.new_pin)
    logAction = 'pin_reset'
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('shops')
    .update(update)
    .eq('id', id)
    .select(SHOP_FIELDS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (logAction) {
    await supabaseAdmin.from('shop_history').insert({
      shop_id: id,
      action: logAction,
      details: logDetails,
    })
  }

  return NextResponse.json({ shop: data })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('shops').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}