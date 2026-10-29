import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashPin, verifyPin } from "@/lib/pin";
import { normalizeShopCode } from "@/lib/shop-code";
import { SHOP_COOKIE, SHOP_MAX_AGE, createShopToken } from "@/lib/shop-auth";

function setSessionCookie(res: NextResponse, shopId: string) {
  res.cookies.set({
    name: SHOP_COOKIE,
    value: createShopToken(shopId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SHOP_MAX_AGE,
    path: "/",
  });
  // A new login forgets any "your shop was deleted" marker.
  res.cookies.set({ name: "shop_deleted", value: "", maxAge: 0, path: "/" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeShopCode((body?.code ?? "").toString());
    const pin = (body?.pin ?? "").toString().trim();

    if (!code || !pin) {
      return NextResponse.json(
        { error: "Code and PIN required", code: "MISSING_FIELDS" },
        { status: 400 },
      );
    }

    const findShop = (c: string) =>
      supabaseAdmin
        .from("shops")
        .select(
          "id, name, status, code, pin_hash, trial_ends_at, subscription_ends_at, login_attempts, locked_until",
        )
        .eq("code", c)
        .maybeSingle();

    let { data: shop, error } = await findShop(code);
    // "my coffee " typed with a stray space at the end becomes "my-coffee-":
    // if that isn't a real code, try it without the dashes at the edges.
    const bare = code.replace(/^-+|-+$/g, "");
    if (!error && !shop && bare && bare !== code) {
      ({ data: shop, error } = await findShop(bare));
    }

    if (error || !shop) {
      return NextResponse.json(
        { error: "Invalid Café Code or PIN", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    if (shop.locked_until && new Date(shop.locked_until) > new Date()) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again in 15 minutes.", code: "TOO_MANY_ATTEMPTS" },
        { status: 429 },
      );
    }

    const { ok, needsRehash } = await verifyPin(pin, shop.pin_hash);
    if (!ok) {
      const attempts = (shop.login_attempts || 0) + 1;
      const locked_until =
        attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      await supabaseAdmin
        .from("shops")
        .update({ login_attempts: attempts, locked_until })
        .eq("id", shop.id);

      return NextResponse.json(
        { error: "Invalid Café Code or PIN", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    // Reset lockout and, if the stored hash is a legacy format, upgrade it
    // to v2 now that we know the PIN.
    const fix: Record<string, unknown> = {};
    if (shop.login_attempts > 0 || shop.locked_until) {
      fix.login_attempts = 0;
      fix.locked_until = null;
    }
    if (needsRehash) fix.pin_hash = await hashPin(pin);
    if (Object.keys(fix).length > 0) {
      let q = supabaseAdmin.from("shops").update(fix).eq("id", shop.id);
      // Don't clobber a PIN reset that happened while we were verifying.
      if (fix.pin_hash) q = q.eq("pin_hash", shop.pin_hash);
      await q;
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
      // Still issue the session cookie: the PIN was correct, and /expired
      // needs identity for support chat (requireShopAuth). Every other shop
      // route uses requireShop, which keeps rejecting until billing is renewed.
      const res = NextResponse.json(
        {
          error: "expired",
          status: "expired",
          reason: subEnds ? "subscription" : "trial",
          shop_id: shop.id,
          shop_name: shop.name,
        },
        { status: 403 },
      );
      setSessionCookie(res, shop.id);
      return res;
    }

    const res = NextResponse.json({
      shop: { id: shop.id, name: shop.name, code: shop.code },
    });
    setSessionCookie(res, shop.id);
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}