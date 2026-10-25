import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireShop } from '@/lib/shop-auth'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await ctx.params

    const guard = await requireShop(resolved.id)
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }
    const id = guard.shopId

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PNG, JPG, WEBP, SVG' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Max 2MB' },
        { status: 400 }
      )
    }

    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
    const path = `${id}/${Date.now()}.${ext}`
    const arrayBuf = await file.arrayBuffer()

    const { error: upErr } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, arrayBuf, {
        contentType: file.type,
        upsert: true,
      })

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const { data: publicUrl } = supabaseAdmin.storage
      .from('logos')
      .getPublicUrl(path)

    const { error: updErr } = await supabaseAdmin
      .from('shops')
      .update({ logo_url: publicUrl.publicUrl })
      .eq('id', id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ logo_url: publicUrl.publicUrl })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}