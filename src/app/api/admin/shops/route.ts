import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch shops
  const { data: shops, error: shopsErr } = await supabaseAdmin
    .from('shops')
    .select('id, name, tagline, status, created_at, logo_url, theme, game')
    .order('created_at', { ascending: false })

  if (shopsErr) {
    return NextResponse.json({ error: shopsErr.message }, { status: 500 })
  }

  // 2. Fetch all orders for stats
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('shop_id, created_at, status')

  // 3. Fetch all reviews for stats
  const { data: reviews } = await supabaseAdmin
    .from('reviews')
    .select('rating')

  // --- CALCULATE STATS ---
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const todayStart = new Date(now).setHours(0, 0, 0, 0)

  let totalOrders = 0
  let ordersToday = 0
  const shopStats = new Map<string, { total: number; last7: number; last30: number }>()

  for (const o of orders ?? []) {
    totalOrders++
    if (new Date(o.created_at).getTime() >= todayStart) {
      ordersToday++
    }

    const s = shopStats.get(o.shop_id) ?? { total: 0, last7: 0, last30: 0 }
    s.total += 1
    const age = now - new Date(o.created_at).getTime()
    if (age <= 7 * day) s.last7 += 1
    if (age <= 30 * day) s.last30 += 1
    shopStats.set(o.shop_id, s)
  }

  const reviewCount = reviews?.length ?? 0
  const ratingSum = (reviews ?? []).reduce((sum, r) => sum + r.rating, 0)
  const avgRating = reviewCount > 0 ? (ratingSum / reviewCount).toFixed(1) : '0.0'

  // --- BUILD RESPONSE ---
  const enrichedShops = (shops ?? []).map((s) => ({
    ...s,
    stats: shopStats.get(s.id) ?? { total: 0, last7: 0, last30: 0 },
  }))

  return NextResponse.json({
    shops: enrichedShops,
    globalStats: {
      totalOrders,
      ordersToday,
      totalShops: shops?.length ?? 0,
      totalReviews: reviewCount,
      avgRating,
    }
  })
}