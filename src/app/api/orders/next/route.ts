import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const shop_id = req.nextUrl.searchParams.get("shop_id");

    if (!shop_id) {
      return NextResponse.json({ error: "shop_id required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("peek_order_number", {
      p_shop_id: shop_id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { next: Number(data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}