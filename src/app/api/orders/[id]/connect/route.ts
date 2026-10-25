import { after, NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pingTopics, shopOrdersTopic } from '@/lib/realtime'

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await ctx.params
    const id = resolved.id

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
    }

    // Only flip (and ping) the first time, so reloads don't spam the dashboard.
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ customer_connected: true })
      .eq('id', id)
      .eq('customer_connected', false)
      .select('shop_id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const shopId = data?.[0]?.shop_id as string | undefined
    if (shopId) after(() => pingTopics([shopOrdersTopic(shopId)], { kind: 'connected' }))

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}