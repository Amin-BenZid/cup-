import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Never include `id`: the shop id is the key to every other shop route.
const PUBLIC_SHOP_FIELDS =
  "name, tagline, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages";

type Row = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  ready_at: string | null;
  customer_connected: boolean;
  shops: Record<string, unknown> | null;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolved = await ctx.params;
    const id = resolved?.id;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // One round trip: the shop is embedded through orders.shop_id, and
    // shop_id itself is never selected into the response.
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(
        `id, order_number, status, created_at, ready_at, customer_connected, shops(${PUBLIC_SHOP_FIELDS})`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[o/[id]]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = data as unknown as Row | null;

    if (!row) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      created_at: row.created_at,
      ready_at: row.ready_at,
      customer_connected: row.customer_connected,
    };

    return NextResponse.json(
      { order, shop: row.shops ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}