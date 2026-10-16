import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolved = await ctx.params;
    const id = resolved.id;

    if (!id) {
      return NextResponse.json({ error: "Missing shop id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const allowed = [
      "name",
      "tagline",
      "logo_url",
      "logo_scale",
      "logo_offset_x",
      "logo_offset_y",
      "theme",
      "game",
      "messages",
    ] as const;

    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) update[k] = body[k];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("shops")
      .update(update)
      .eq("id", id)
.select(
  'id, name, tagline, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages'
)      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shop: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolved = await ctx.params;
    const id = resolved.id;

    const { data, error } = await supabaseAdmin
      .from("shops")
      .select("id, name, tagline, logo_url, theme, game, messages")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shop: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
