import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await ctx.params
    const id = resolved?.id

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('shops')
      .select(
        'id, name, tagline, status, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages, has_created_order'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[shops GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ shop: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[shops GET] crash:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await ctx.params
    const id = resolved?.id

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const allowed = [
      'name',
      'tagline',
      'logo_url',
      'logo_scale',
      'logo_offset_x',
      'logo_offset_y',
      'theme',
      'game',
      'messages',
      'has_created_order',
    ] as const

    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) {
        update[key] = body[key]
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Nothing to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update(update)
      .eq('id', id)
      .select(
        'id, name, tagline, status, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages, has_created_order'
      )
      .single()

    if (error) {
      console.error('[shops PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ shop: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[shops PATCH] crash:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}