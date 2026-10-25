import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { readAdminAudit } from "@/lib/admin-audit";

/** Café history (all shops) + admin security log. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const [historyRes, audit] = await Promise.all([
      supabaseAdmin
        .from("shop_history")
        .select("id, action, details, created_at, shop_id, shops(name)")
        .order("created_at", { ascending: false })
        .limit(300),
      readAdminAudit(),
    ]);
    if (historyRes.error) throw historyRes.error;

    return NextResponse.json(
      {
        history: (historyRes.data ?? []).map((h) => ({
          id: h.id,
          action: h.action,
          details: h.details,
          created_at: h.created_at,
          shop_id: h.shop_id,
          shop_name:
            (Array.isArray(h.shops) ? h.shops[0]?.name : (h.shops as { name?: string } | null)?.name) ??
            null,
        })),
        audit,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
