import { cookies } from "next/headers";
import crypto from "crypto";

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

export function verifyShopToken(
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
 * Returns the authenticated shop id, optionally verifying it matches a
 * requested id. Never trust a client-supplied shop_id without this.
 */
export async function requireShop(requestedId?: string) {
  const session = await getShopSession();
  if (!session) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }
  if (requestedId && session.shopId !== requestedId) {
    return { ok: false as const, error: "Forbidden", status: 403 };
  }
  return { ok: true as const, shopId: session.shopId };
}

export const SHOP_COOKIE = COOKIE_NAME;
export const SHOP_MAX_AGE = MAX_AGE_SECONDS;