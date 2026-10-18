import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select(`
      id, message, status, created_at, shop_id,
      shops ( name, logo_url )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const body = await req.json().catch(() => ({}))
  const id = (body?.id ?? '').toString()
  const status = (body?.status ?? '').toString()

  if (!id || !['read', 'resolved'].includes(status)) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('support_messages').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}