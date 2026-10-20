import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPin } from "@/lib/hash";
import { SHOP_COOKIE, SHOP_MAX_AGE, createShopToken } from "@/lib/shop-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = (body?.code ?? "").toString().trim().toLowerCase();
    const pin = (body?.pin ?? "").toString().trim();

    if (!code || !pin) {
      return NextResponse.json(
        { error: "Code and PIN required" },
        { status: 400 },
      );
    }

    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select(
        "id, name, status, code, pin_hash, trial_ends_at, subscription_ends_at, login_attempts, locked_until",
      )
      .eq("code", code)
      .maybeSingle();

    if (error || !shop) {
      return NextResponse.json(
        { error: "Invalid Café Code or PIN" },
        { status: 401 },
      );
    }

    if (shop.locked_until && new Date(shop.locked_until) > new Date()) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    }

    const pin_hash = await hashPin(pin);
    if (pin_hash !== shop.pin_hash) {
      const attempts = (shop.login_attempts || 0) + 1;
      const locked_until =
        attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      await supabaseAdmin
        .from("shops")
        .update({ login_attempts: attempts, locked_until })
        .eq("id", shop.id);

      return NextResponse.json(
        { error: "Invalid Café Code or PIN" },
        { status: 401 },
      );
    }

    if (shop.login_attempts > 0 || shop.locked_until) {
      await supabaseAdmin
        .from("shops")
        .update({ login_attempts: 0, locked_until: null })
        .eq("id", shop.id);
    }

    if (shop.status === "pending") {
      return NextResponse.json(
        {
          error: "pending",
          status: "pending",
          shop_id: shop.id,
          shop_name: shop.name,
        },
        { status: 403 },
      );
    }

    if (shop.status === "disabled") {
      return NextResponse.json(
        { error: "disabled", status: "disabled" },
        { status: 403 },
      );
    }

    const now = Date.now();
    const trialEnds = shop.trial_ends_at
      ? new Date(shop.trial_ends_at).getTime()
      : null;
    const subEnds = shop.subscription_ends_at
      ? new Date(shop.subscription_ends_at).getTime()
      : null;

    const trialOk = !!trialEnds && trialEnds > now;
    const subOk = !!subEnds && subEnds > now;

    if (!trialOk && !subOk) {
      return NextResponse.json(
        {
          error: "expired",
          status: "expired",
          reason: subEnds ? "subscription" : "trial",
          shop_id: shop.id,
          shop_name: shop.name,
        },
        { status: 403 },
      );
    }

    const res = NextResponse.json({
      shop: { id: shop.id, name: shop.name, code: shop.code },
    });

    res.cookies.set({
      name: SHOP_COOKIE,
      value: createShopToken(shop.id),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SHOP_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}