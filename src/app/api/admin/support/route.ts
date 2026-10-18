import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select(`
      id, message, created_at, shop_id, sender, is_read,
      shops ( name, logo_url )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  
  const unread = (data ?? []).filter(m => m.sender === 'barista' && !m.is_read).length

  return NextResponse.json({ messages: data ?? [], unread })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
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
      sender: 'admin',
      is_read: false 
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const body = await req.json().catch(() => ({}))
  const shop_id = (body?.shop_id ?? '').toString()

  if (!shop_id) return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('support_messages')
    .update({ is_read: true })
    .eq('shop_id', shop_id)
    .eq('sender', 'barista')
    .eq('is_read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}