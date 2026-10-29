import crypto from "node:crypto";
import { getWebPush } from "@/lib/send-push";
import { deleteSetting, getSetting, listSettings, setSetting } from "@/lib/settings";
import { listArchives } from "@/lib/shop-archive";

/**
 * Push notifications to a shop's staff phones (messages from the Beep team
 * and broadcasts). Devices live in global_settings:
 *   shop_push:<shopId>:<sha256(endpoint)[0..24]> = ShopDevice
 * No schema change. Never throws.
 */

const PREFIX = "shop_push:";
const MAX_DEVICES_PER_SHOP = 10;

type Sub = { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } };
export type ShopDevice = { subscription: Sub; locale: string; created_at: string; last_sent_at: string | null };

const TEXT = {
  support: { fr: "Nouveau message du support", ar: "رسالة جديدة من الدعم", en: "New message from support" },
  broadcast: { fr: "Annonce Beep", ar: "إعلان من Beep", en: "Beep announcement" },
} as const;

const deviceKey = (shopId: string, endpoint: string) =>
  `${PREFIX}${shopId}:${crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 24)}`;

export function isValidSubscription(s: unknown): s is Sub {
  const v = s as Sub;
  return (
    !!v &&
    typeof v.endpoint === "string" &&
    /^https:\/\//.test(v.endpoint) &&
    v.endpoint.length < 2048 &&
    typeof v.keys?.p256dh === "string" &&
    typeof v.keys?.auth === "string"
  );
}

export async function saveShopDevice(shopId: string, sub: Sub, locale: string) {
  const key = deviceKey(shopId, sub.endpoint);
  const existing = await getSetting<ShopDevice>(key).catch(() => null);
  await setSetting(key, {
    subscription: { endpoint: sub.endpoint, expirationTime: sub.expirationTime ?? null, keys: sub.keys },
    locale: ["fr", "ar", "en"].includes(locale) ? locale : "fr",
    created_at: existing?.created_at ?? new Date().toISOString(),
    last_sent_at: existing?.last_sent_at ?? null,
  } satisfies ShopDevice);

  // Keep the newest devices only.
  const all = await listSettings<ShopDevice>(`${PREFIX}${shopId}:`).catch(() => []);
  if (all.length > MAX_DEVICES_PER_SHOP) {
    const oldest = all
      .sort((a, b) => (a.value.created_at ?? "").localeCompare(b.value.created_at ?? ""))
      .slice(0, all.length - MAX_DEVICES_PER_SHOP);
    for (const r of oldest) await deleteSetting(r.key).catch(() => {});
  }
}

export async function removeShopDevice(shopId: string, endpoint: string) {
  await deleteSetting(deviceKey(shopId, endpoint)).catch(() => {});
}

async function sendTo(rows: { key: string; value: ShopDevice }[], kind: "support" | "broadcast", body: string, url: string) {
  const wp = getWebPush();
  if (!wp || rows.length === 0) return 0;
  const text = body.length > 160 ? `${body.slice(0, 157)}…` : body;
  let sent = 0;
  await Promise.all(
    rows.map(async ({ key, value }) => {
      const lang = (value.locale as "fr" | "ar" | "en") in TEXT[kind] ? (value.locale as "fr" | "ar" | "en") : "fr";
      const payload = JSON.stringify({ title: TEXT[kind][lang], body: text, url, tag: `beep-${kind}` });
      try {
        await wp.sendNotification(value.subscription, payload, { TTL: 24 * 60 * 60 });
        sent++;
        await setSetting(key, { ...value, last_sent_at: new Date().toISOString() }).catch(() => {});
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        // The phone unsubscribed or the browser dropped it: forget the device.
        if (status === 404 || status === 410) await deleteSetting(key).catch(() => {});
        else console.error("[shop-notify]", status ?? err);
      }
    }),
  );
  return sent;
}

/** A message from the Beep team to one shop. */
export async function notifyShopSupport(shopId: string, message: string): Promise<number> {
  try {
    const rows = await listSettings<ShopDevice>(`${PREFIX}${shopId}:`);
    return await sendTo(rows, "support", message, "/barista/dashboard?support=1");
  } catch (e) {
    console.error("[shop-notify] support", e);
    return 0;
  }
}

/** A broadcast to every shop (archived shops are skipped). */
export async function notifyAllShopsBroadcast(message: string): Promise<number> {
  try {
    const [rows, archives] = await Promise.all([listSettings<ShopDevice>(PREFIX), listArchives()]);
    const live = rows.filter((r) => !archives.has(r.key.slice(PREFIX.length).split(":")[0]));
    return await sendTo(live, "broadcast", message, "/barista/dashboard");
  } catch (e) {
    console.error("[shop-notify] broadcast", e);
    return 0;
  }
}
