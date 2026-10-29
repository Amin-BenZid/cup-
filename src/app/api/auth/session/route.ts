import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getShopSession, SHOP_COOKIE } from "@/lib/shop-auth";
import { getShopAccess } from "@/lib/shop-access";

const NO_STORE = { "Cache-Control": "no-store" };
/** Set when a deleted shop's session is dropped, so a reload still says why. */
const DELETED_MARKER = "shop_deleted";

/**
 * Who is signed in and what they can do right now. `state` drives which
 * screen the staff app shows (see lib/shop-access.ts). 401 means there is no
 * usable session: signed out, or the café was deleted.
 */
export async function GET() {
  const session = await getShopSession();
  if (!session) {
    const gone = (await cookies()).get(DELETED_MARKER)?.value === "1";
    return NextResponse.json(
      { shop: null, active: false, state: gone ? "deleted" : "signed_out" },
      { status: 401, headers: NO_STORE },
    );
  }

  const access = await getShopAccess(session.shopId);

  if (access.state === "deleted") {
    const res = NextResponse.json({ shop: null, active: false, state: "deleted" }, { status: 401, headers: NO_STORE });
    // The café is gone: drop its cookie so nothing keeps using it.
    res.cookies.set({
      name: SHOP_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    res.cookies.set({
      name: DELETED_MARKER,
      value: "1",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  }

  return NextResponse.json(
    {
      shop: access.shop,
      active: access.state === "ok",
      state: access.state,
      reason: access.reason ?? null,
      trial_ok: access.trial_ok ?? false,
      subscription_ok: access.subscription_ok ?? false,
    },
    { headers: NO_STORE },
  );
}
