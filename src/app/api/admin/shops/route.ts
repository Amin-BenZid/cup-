import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: shops, error: shopsErr } = await supabaseAdmin
    .from('shops')
    .select('id, name, tagline, status, created_at, logo_url, theme, game')
    .order('created_at', { ascending: false })

  if (shopsErr) {
    return NextResponse.json({ error: shopsErr.message }, { status: 500 })
  }

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('shop_id, created_at, status')

  const stats = new Map<
    string,
    { total: number; last7: number; last30: number }
  >()
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  for (const o of orders ?? []) {
    const s = stats.get(o.shop_id) ?? { total: 0, last7: 0, last30: 0 }
    s.total += 1
    const age = now - new Date(o.created_at).getTime()
    if (age <= 7 * day) s.last7 += 1
    if (age <= 30 * day) s.last30 += 1
    stats.set(o.shop_id, s)
  }

  const result = (shops ?? []).map((s) => ({
    ...s,
    stats: stats.get(s.id) ?? { total: 0, last7: 0, last30: 0 },
  }))

  return NextResponse.json({ shops: result })
}