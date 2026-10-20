import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getShopSession } from "@/lib/shop-auth";

export async function GET() {
  const session = await getShopSession();

  if (!session) {
    return NextResponse.json(
      { shop: null, active: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("id, name, status, trial_ends_at, subscription_ends_at")
    .eq("id", session.shopId)
    .maybeSingle();

  if (!shop) {
    return NextResponse.json({ shop: null, active: false }, { status: 401 });
  }

  const now = Date.now();
  const trialOk =
    !!shop.trial_ends_at && new Date(shop.trial_ends_at).getTime() > now;
  const subOk =
    !!shop.subscription_ends_at &&
    new Date(shop.subscription_ends_at).getTime() > now;

  const active = shop.status === "active" && (trialOk || subOk);

  return NextResponse.json(
    {
      shop: { id: shop.id, name: shop.name, status: shop.status },
      active,
      trial_ok: trialOk,
      subscription_ok: subOk,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}