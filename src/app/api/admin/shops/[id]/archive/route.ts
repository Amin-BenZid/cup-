import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminEvent } from "@/lib/admin-audit";
import { archiveShop, getArchive, restoreShop } from "@/lib/shop-archive";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

/**
 * POST { action: "archive" | "restore" }
 * Archive blocks the café at once (status → disabled) and hides it from the
 * lists; all data is kept. Restore puts back the status it had before.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "archive" && action !== "restore") {
      return NextResponse.json({ error: "Bad action" }, { status: 400 });
    }

    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select("name, code, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const existing = await getArchive(id);

    if (action === "archive") {
      if (existing) {
        return NextResponse.json({ ok: true, archived: true, archived_at: existing.archived_at });
      }
      const record = await archiveShop(id, shop.status);
      await supabaseAdmin
        .from("shop_history")
        .insert({ shop_id: id, action: "archived", details: { from: shop.status } });
      await logAdminEvent(req, "shop_archived", { shop: shop.name, code: shop.code });
      return NextResponse.json({ ok: true, archived: true, archived_at: record.archived_at });
    }

    if (!existing) return NextResponse.json({ ok: true, archived: false });
    const status = await restoreShop(id);
    await supabaseAdmin
      .from("shop_history")
      .insert({ shop_id: id, action: "restored", details: { to: status } });
    await logAdminEvent(req, "shop_restored", { shop: shop.name, code: shop.code });
    return NextResponse.json({ ok: true, archived: false, status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
