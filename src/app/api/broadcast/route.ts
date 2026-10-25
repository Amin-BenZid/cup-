import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'

export async function GET() {
  // 1. Fetch current active broadcast
  const { data, error } = await supabaseAdmin
    .from('global_settings')
    .select('value')
    .eq('key', 'broadcast')
    .maybeSingle()

  // 2. Fetch broadcast history
  const { data: history } = await supabaseAdmin
    .from('broadcast_history')
    .select('id, message, active, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ 
      broadcast: { active: false, message: '' },
      history: history ?? []
    })
  }
  
  let broadcast = data?.value ?? { active: false, message: '' }
  if (typeof broadcast === 'string') {
    try { broadcast = JSON.parse(broadcast) } catch {}
  }

  return NextResponse.json({ 
    broadcast, 
    history: history ?? [] 
  })
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied
  
  const body = await req.json().catch(() => ({}))
  const active = !!body.active
  const message = (body.message ?? '').toString().trim().slice(0, 280)

  const value = { active, message }

  const { error } = await supabaseAdmin
    .from('global_settings')
    .upsert(
      { key: 'broadcast', value },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('[Broadcast API] PATCH Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log this action to history
  if (message) {
    await supabaseAdmin.from('broadcast_history').insert({
      message,
      active
    })
  }
  
  await logAdminEvent(req, active ? 'broadcast_on' : 'broadcast_off', { message })
  return NextResponse.json({ ok: true, broadcast: value })
}