import { after, NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashPin } from '@/lib/pin'
import { notifyAdmin } from '@/lib/admin-notify'

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // Replace spaces with -
    .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
    .replace(/\-\-+/g, '-')     // Replace multiple - with single -
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = (body?.name ?? '').toString().trim()
    const codeInput = (body?.code ?? '').toString().trim()
    const pin = (body?.pin ?? '').toString()

    if (!name) {
      return NextResponse.json({ error: 'Shop name required' }, { status: 400 })
    }
    if (pin.length !== 6) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits' },
        { status: 400 }
      )
    }

    let code = slugify(codeInput || name)
    
    // Ensure it's at least 3 chars, if not, append a random string
    if (code.length < 3) {
      code = `shop-${Math.random().toString(36).substring(2, 7)}`
    }

    // Check if code is already taken
    const { data: existing } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (existing) {
      // Add a random suffix if it's taken
      code = `${code}-${Math.random().toString(36).substring(2, 5)}`
    }

    const pin_hash = await hashPin(pin)

    const { data, error } = await supabaseAdmin
      .from('shops')
      .insert({
        name,
        code,
        pin_hash,
        status: 'pending',
        billing_status: 'trial',
        trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, name, code, status')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin.from('shop_history').insert({
      shop_id: data.id,
      action: 'created',
      details: { name: data.name, code: data.code },
    })

    // Ping the admin's phone: a new café is waiting for approval.
    after(() =>
      notifyAdmin({
        kind: 'signup',
        title: 'New café to approve',
        body: `${data.name} (${data.code}) just signed up.`,
        url: `/admin/shops/${data.id}`,
      }),
    )

    return NextResponse.json({ shop: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}