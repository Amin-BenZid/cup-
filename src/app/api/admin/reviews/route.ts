import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select(`
      id, rating, comment, created_at, shop_id,
      shops ( name, logo_url )
    `)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { reviews: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}