import crypto from "crypto";

/**
 * Live "something changed" signals over Supabase Realtime Broadcast.
 *
 * Security model: payloads never contain message text or personal data, only
 * a hint to refetch. Clients then load data through the authenticated API.
 * Channel names are HMACs of the shop id with a server secret, so they can't
 * be guessed; each client learns its topic only from an authenticated API
 * response.
 */

function secret() {
  const s = process.env.SHOP_SESSION_SECRET || process.env.ADMIN_SECRET;
  if (!s) throw new Error("SHOP_SESSION_SECRET not set");
  return s;
}

function tag(input: string) {
  return crypto.createHmac("sha256", secret()).update(`rt:${input}`).digest("hex").slice(0, 24);
}

/** Topic the barista app of one shop listens on. */
export function shopSupportTopic(shopId: string) {
  return `sup-${tag(`shop:${shopId}`)}`;
}

/** Topic the admin app listens on (all shops). */
export function adminSupportTopic() {
  return `sup-${tag("admin")}`;
}

/** Fire-and-forget broadcast. Never throws; resolves within ~2.5 s. */
export async function pingTopics(topics: string[], payload: Record<string, unknown> = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || topics.length === 0) return;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: topics.map((topic) => ({ topic, event: "change", payload, private: false })),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) console.error("[realtime] broadcast failed:", res.status);
  } catch (e) {
    console.error("[realtime] broadcast error:", e instanceof Error ? e.message : e);
  }
}

/** Notify both sides of a shop's support thread. */
export function pingSupport(shopId: string, kind: "message" | "delivered" | "read") {
  return pingTopics([shopSupportTopic(shopId), adminSupportTopic()], { kind });
}

/** Topic a customer's order page listens on. */
export function orderTopic(orderId: string) {
  return `ord-${tag(`order:${orderId}`)}`;
}

/** Topic a shop's barista dashboard listens on (all its orders). */
export function shopOrdersTopic(shopId: string) {
  return `ords-${tag(`shop:${shopId}`)}`;
}

/** An order changed: wake the customer's page and the shop's dashboard. */
export function pingOrder(orderId: string, shopId: string | null) {
  const topics = [orderTopic(orderId)];
  if (shopId) topics.push(shopOrdersTopic(shopId));
  return pingTopics(topics, { kind: "order" });
}
