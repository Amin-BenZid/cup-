import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendOrderReadyPush } from '@/lib/send-push'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await ctx.params
    const id = resolved.id

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const status = (body?.status ?? '').toString()

    if (!['preparing', 'ready', 'done'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const update: Record<string, unknown> = { status }
    if (status === 'ready') update.ready_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fire and forget push
    if (status === 'ready') {
      sendOrderReadyPush(id).catch((e) =>
        console.error('Push error:', e)
      )
    }

    return NextResponse.json({ order: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}