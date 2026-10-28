import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShop } from "@/lib/shop-auth";
import { normalizePhone } from "@/lib/phone";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

/**
 * POST { phone } — a signed-in shop adds its phone number.
 *
 * This is the number the Beep team calls to verify "forgot PIN" requests, so
 * a shop can set it once; changing an existing number goes through the admin.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const guard = await requireShop(id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });
    }

    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(String(body?.phone ?? ""));
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone number", code: "INVALID_PHONE" }, { status: 400 });
    }

    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select("phone")
      .eq("id", guard.shopId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (shop.phone) {
      return NextResponse.json({ error: "Phone already set", code: "PHONE_ALREADY_SET" }, { status: 409 });
    }

    // Only fills an empty phone, even if two requests race.
    const base = supabaseAdmin.from("shops").update({ phone }).eq("id", guard.shopId);
    const { data: updated, error: upErr } = await (shop.phone === null
      ? base.is("phone", null)
      : base.eq("phone", shop.phone)
    ).select("id");
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    if (!updated?.length) {
      return NextResponse.json({ error: "Phone already set", code: "PHONE_ALREADY_SET" }, { status: 409 });
    }

    await supabaseAdmin
      .from("shop_history")
      .insert({ shop_id: guard.shopId, action: "phone_added", details: { by: "shop" } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
