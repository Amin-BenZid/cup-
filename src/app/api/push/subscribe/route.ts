import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const order_id = (body?.order_id ?? '').toString()
    const subscription = body?.subscription

    if (!order_id || !subscription?.endpoint) {
      return NextResponse.json(
        { error: 'order_id and subscription required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          order_id,
          endpoint: subscription.endpoint,
          subscription,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('Push subscribe error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}