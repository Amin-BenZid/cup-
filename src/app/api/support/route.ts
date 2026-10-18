import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const shop_id = (body?.shop_id ?? '').toString()
    const message = (body?.message ?? '').toString().trim()

    if (!shop_id || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .insert({ 
        shop_id, 
        message, 
        sender: 'barista', 
        is_read: false
      })
      .select()
      .single()

    if (error) {
      console.error('Barista support insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ message: data })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const shop_id = req.nextUrl.searchParams.get('shop_id')
    if (!shop_id) return NextResponse.json({ error: 'shop_id required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .select('*')
      .eq('shop_id', shop_id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    // Count unread messages from admin
    const unread = (data ?? []).filter(m => m.sender === 'admin' && !m.is_read).length

    return NextResponse.json({ messages: data ?? [], unread })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const shop_id = (body?.shop_id ?? '').toString()

    if (!shop_id) return NextResponse.json({ error: 'Missing shop_id' }, { status: 400 })

    await supabaseAdmin
      .from('support_messages')
      .update({ is_read: true })
      .eq('shop_id', shop_id)
      .eq('sender', 'admin')
      .eq('is_read', false)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}