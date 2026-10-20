import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getShopSession } from "@/lib/shop-auth";

export async function GET() {
  const session = await getShopSession();

  if (!session) {
    return NextResponse.json(
      { shop: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("id, name, status")
    .eq("id", session.shopId)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ shop: null }, { status: 401 });
  }

  return NextResponse.json(
    { shop },
    { headers: { "Cache-Control": "no-store" } },
  );
}