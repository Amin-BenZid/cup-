import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminAuthed } from '@/lib/admin-auth'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('global_settings')
    .select('value')
    .eq('key', 'broadcast')
    .maybeSingle()

  if (error) {
    console.error('[Broadcast API] GET Error:', error)
    return NextResponse.json({ broadcast: { active: false, message: '' } })
  }
  
  let broadcast = data?.value ?? { active: false, message: '' }
  
  // Postgres might return the JSONB column as a string. Parse it.
  if (typeof broadcast === 'string') {
    try {
      broadcast = JSON.parse(broadcast)
    } catch (e) {
      console.error('[Broadcast API] Failed to parse JSON:', e)
    }
  }

  return NextResponse.json({ broadcast })
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const body = await req.json().catch(() => ({}))
  const active = !!body.active
  const message = (body.message ?? '').toString().trim()

  // Create a proper JSON object
  const value = { active, message }

  const { data, error } = await supabaseAdmin
    .from('global_settings')
    .upsert(
      { key: 'broadcast', value },
      { onConflict: 'key' }
    )
    .select()

  if (error) {
    console.error('[Broadcast API] PATCH Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ ok: true, broadcast: value })
}