import crypto from "crypto";
import type { PushSubscription } from "web-push";
import { getWebPush } from "@/lib/send-push";
import {
  deleteSetting,
  getSetting,
  listSettings,
  setSetting,
} from "@/lib/settings";

/**
 * Web-push notifications to the admin's own devices (e.g. iPhone home-screen
 * app). Devices live in global_settings under `admin_push:<hash>`.
 */

const DEVICE_PREFIX = "admin_push:";
const PREFS_KEY = "admin_notify_prefs";
const THROTTLE_PREFIX = "admin_notify_throttle:";

export type NotifyKind = "signup" | "support" | "billing" | "test";

export type NotifyPrefs = { signup: boolean; support: boolean; billing: boolean };

const DEFAULT_PREFS: NotifyPrefs = { signup: true, support: true, billing: true };

export type AdminDevice = {
  subscription: PushSubscription;
  label: string;
  ua: string;
  created_at: string;
  last_sent_at?: string | null;
};

export function deviceKey(endpoint: string) {
  return (
    DEVICE_PREFIX +
    crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 32)
  );
}

export async function getNotifyPrefs(): Promise<NotifyPrefs> {
  try {
    const p = await getSetting<Partial<NotifyPrefs>>(PREFS_KEY);
    return { ...DEFAULT_PREFS, ...(p ?? {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setNotifyPrefs(p: Partial<NotifyPrefs>) {
  const current = await getNotifyPrefs();
  const next: NotifyPrefs = {
    signup: typeof p.signup === "boolean" ? p.signup : current.signup,
    support: typeof p.support === "boolean" ? p.support : current.support,
    billing: typeof p.billing === "boolean" ? p.billing : current.billing,
  };
  await setSetting(PREFS_KEY, next);
  return next;
}

export async function listAdminDevices() {
  const rows = await listSettings<AdminDevice>(DEVICE_PREFIX);
  return rows
    .filter((r) => r.value?.subscription?.endpoint)
    .map((r) => ({ key: r.key, ...r.value }));
}

export async function saveAdminDevice(
  subscription: PushSubscription,
  label: string,
  ua: string,
) {
  const key = deviceKey(subscription.endpoint);
  const existing = await getSetting<AdminDevice>(key).catch(() => null);
  await setSetting(key, {
    subscription,
    label: label.slice(0, 60) || "Device",
    ua: ua.slice(0, 200),
    created_at: existing?.created_at ?? new Date().toISOString(),
    last_sent_at: existing?.last_sent_at ?? null,
  } satisfies AdminDevice);
  return key;
}

export async function removeAdminDevice(key: string) {
  if (!key.startsWith(DEVICE_PREFIX)) throw new Error("Bad device key");
  await deleteSetting(key);
}

type Notice = {
  kind: NotifyKind;
  title: string;
  body: string;
  url: string;
  /** Collapse key: same throttleKey within throttleMs sends only once. */
  throttleKey?: string;
  throttleMs?: number;
};

/** Never throws. Returns how many devices accepted the push. */
export async function notifyAdmin(n: Notice): Promise<number> {
  try {
    if (n.kind !== "test") {
      const prefs = await getNotifyPrefs();
      if (!prefs[n.kind]) return 0;
    }

    if (n.throttleKey && n.throttleMs) {
      const tKey = THROTTLE_PREFIX + n.throttleKey;
      const last = await getSetting<{ at: number }>(tKey).catch(() => null);
      if (last && Date.now() - last.at < n.throttleMs) return 0;
      await setSetting(tKey, { at: Date.now() }).catch(() => {});
    }

    const wp = getWebPush();
    if (!wp) return 0;

    const devices = await listAdminDevices();
    if (devices.length === 0) return 0;

    const payload = JSON.stringify({
      title: n.title,
      body: n.body,
      url: n.url,
      tag: `admin-${n.kind}`,
    });

    const results = await Promise.all(
      devices.map(async (d) => {
        try {
          await wp.sendNotification(d.subscription, payload, { TTL: 60 * 60 * 24 });
          await setSetting(d.key, { ...stripKey(d), last_sent_at: new Date().toISOString() }).catch(() => {});
          return 1;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await deleteSetting(d.key).catch(() => {});
          } else {
            console.error("[admin-notify] push failed:", status ?? err);
          }
          return 0;
        }
      }),
    );
    return results.reduce<number>((a, b) => a + b, 0);
  } catch (e) {
    console.error("[admin-notify]", e);
    return 0;
  }
}

function stripKey(d: AdminDevice & { key: string }): AdminDevice {
  const { key: _key, ...rest } = d;
  void _key;
  return rest;
}
