import { supabaseAdmin } from "@/lib/supabase-admin";

// Never include `id`: the shop id is the key to every other shop route.
const PUBLIC_SHOP_FIELDS =
  "name, tagline, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages";

export type PublicOrder = {
  id: string;
  order_number: string;
  status: "preparing" | "ready" | "done";
  created_at: string;
  ready_at: string | null;
  customer_connected: boolean;
};

export type PublicShop = Record<string, unknown>;

type Row = PublicOrder & { shops: PublicShop | null };

export type PublicOrderResult =
  | { ok: true; order: PublicOrder; shop: PublicShop | null }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false; error: string };

/**
 * Customer-safe view of an order and its shop branding, in one round trip.
 * Server-only (uses the service-role client). Shared by GET /api/o/[id]
 * and the server render of /o/[id].
 */
export async function getPublicOrder(id: string): Promise<PublicOrderResult> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `id, order_number, status, created_at, ready_at, customer_connected, shops(${PUBLIC_SHOP_FIELDS})`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // 22P02 = invalid uuid syntax: treat a malformed id as "not found".
    if (error.code === "22P02") return { ok: false, notFound: true };
    return { ok: false, notFound: false, error: error.message };
  }

  const row = data as unknown as Row | null;
  if (!row) return { ok: false, notFound: true };

  return {
    ok: true,
    order: {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      created_at: row.created_at,
      ready_at: row.ready_at,
      customer_connected: row.customer_connected,
    },
    shop: row.shops ?? null,
  };
}
