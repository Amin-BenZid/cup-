import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getArchive } from "@/lib/shop-archive";

const COOKIE_NAME = "shop_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const s = process.env.SHOP_SESSION_SECRET || process.env.ADMIN_SECRET;
  if (!s) throw new Error("SHOP_SESSION_SECRET not set");
  return s;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createShopToken(shopId: string): string {
  const issued = Date.now().toString();
  const payload = `${shopId}.${issued}`;
  return `${payload}.${sign(payload)}`;
}

function verifyShopToken(
  token: string | undefined,
): { shopId: string } | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [shopId, issued, sig] = parts;
  const expected = sign(`${shopId}.${issued}`);

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return null;
  if ((Date.now() - issuedAt) / 1000 > MAX_AGE_SECONDS) return null;

  return { shopId };
}

export async function getShopSession(): Promise<{ shopId: string } | null> {
  const store = await cookies();
  return verifyShopToken(store.get(COOKIE_NAME)?.value);
}

/**
 * Identity only: a valid session for this shop, regardless of billing.
 * ONLY use this for support messaging, so an expired shop can reach you.
 */
export async function requireShopAuth(requestedId?: string) {
  const session = await getShopSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized", status: 401, code: "signed_out" };
  }
  if (requestedId && session.shopId !== requestedId) {
    return { ok: false as const, error: "Forbidden", status: 403, code: "forbidden" };
  }
  // The cookie can outlive the café: refuse deleted and archived ones.
  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("id")
    .eq("id", session.shopId)
    .maybeSingle();
  if (!shop) {
    return { ok: false as const, error: "Unauthorized", status: 401, code: "deleted" };
  }
  if (await getArchive(session.shopId)) {
    return { ok: false as const, error: "Account closed", status: 403, code: "archived" };
  }
  return { ok: true as const, shopId: session.shopId };
}

/**
 * Identity + entitlement. Everything else must use this.
 */
export async function requireShop(requestedId?: string) {
  const session = await getShopSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized", status: 401, code: "signed_out" };
  }
  if (requestedId && session.shopId !== requestedId) {
    return { ok: false as const, error: "Forbidden", status: 403, code: "forbidden" };
  }
  const auth = { ok: true as const, shopId: session.shopId };

  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("status, trial_ends_at, subscription_ends_at")
    .eq("id", auth.shopId)
    .maybeSingle();

  if (!shop) {
    return { ok: false as const, error: "Unauthorized", status: 401, code: "deleted" };
  }

  if (shop.status !== "active") {
    return { ok: false as const, error: "Account inactive", status: 403, code: "inactive" };
  }

  const now = Date.now();
  const trialOk =
    !!shop.trial_ends_at && new Date(shop.trial_ends_at).getTime() > now;
  const subOk =
    !!shop.subscription_ends_at &&
    new Date(shop.subscription_ends_at).getTime() > now;

  if (!trialOk && !subOk) {
    return { ok: false as const, error: "Subscription expired", status: 403, code: "expired" };
  }

  return { ok: true as const, shopId: auth.shopId };
}

export const SHOP_COOKIE = COOKIE_NAME;
export const SHOP_MAX_AGE = MAX_AGE_SECONDS;