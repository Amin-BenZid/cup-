import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const months = Number(body?.months) || 0

  if (months === 0) {
    return NextResponse.json({ error: 'Invalid months' }, { status: 400 })
  }

  const { data: shop, error: shopErr } = await supabaseAdmin
    .from('shops')
    .select('subscription_ends_at')
    .eq('id', id)
    .single()

  if (shopErr || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  // Calculate new date
  let baseDate = shop.subscription_ends_at ? new Date(shop.subscription_ends_at) : new Date()
  if (baseDate < new Date()) baseDate = new Date()

  const newDate = new Date(baseDate)
  newDate.setMonth(newDate.getMonth() + months)

  const { data, error } = await supabaseAdmin
    .from('shops')
    .update({
      billing_status: 'active',
      subscription_ends_at: newDate.toISOString(),
      paid_current_month: true, // Mark as paid this month
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  // Log the action
  await supabaseAdmin.from('shop_history').insert({
    shop_id: id,
    action: 'billing_extended',
    details: { months, new_date: newDate.toISOString() },
  })

  return NextResponse.json({ shop: data })
}