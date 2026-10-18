import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST: Send a message (from barista)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const shop_id = (body?.shop_id ?? '').toString()
  const message = (body?.message ?? '').toString().trim()

  if (!shop_id || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .insert({ shop_id, message })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}

// GET: Fetch messages for a specific shop (from barista)
export async function GET(req: NextRequest) {
  const shop_id = req.nextUrl.searchParams.get('shop_id')
  if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select('*')
    .eq('shop_id', shop_id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}