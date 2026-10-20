import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShop } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  try {
    const shop_id = req.nextUrl.searchParams.get("shop_id");

    if (!shop_id) {
      return NextResponse.json({ error: "shop_id required" }, { status: 400 });
    }

    const guard = await requireShop(shop_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("shop_id", guard.shopId)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { orders: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}