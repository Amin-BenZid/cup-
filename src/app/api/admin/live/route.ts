import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch latest orders across ALL shops
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      created_at,
      ready_at,
      shop_id,
      shops (
        name,
        logo_url
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orders: orders ?? [] })
}