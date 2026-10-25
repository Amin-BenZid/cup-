import { NextRequest, NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deviceKey,
  listAdminDevices,
  removeAdminDevice,
  saveAdminDevice,
} from "@/lib/admin-notify";
import { logAdminEvent } from "@/lib/admin-audit";

/** List the admin's registered notification devices. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const devices = await listAdminDevices();
    return NextResponse.json(
      {
        devices: devices.map((d) => ({
          key: d.key,
          label: d.label,
          ua: d.ua,
          created_at: d.created_at,
          last_sent_at: d.last_sent_at ?? null,
          endpoint_host: safeHost(d.subscription.endpoint),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Register this device: { subscription, label } */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const sub = body?.subscription as PushSubscription | undefined;
    if (
      !sub?.endpoint ||
      !/^https:\/\//.test(sub.endpoint) ||
      !sub.keys?.p256dh ||
      !sub.keys?.auth
    ) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    const label = String(body?.label ?? "").trim();
    const key = await saveAdminDevice(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      label,
      req.headers.get("user-agent") ?? "",
    );
    await logAdminEvent(req, "push_device_added", { label });
    return NextResponse.json({ ok: true, key });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Remove a device: { key } or { endpoint } */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const key = body?.key
      ? String(body.key)
      : body?.endpoint
        ? deviceKey(String(body.endpoint))
        : "";
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
    await removeAdminDevice(key);
    await logAdminEvent(req, "push_device_removed");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
