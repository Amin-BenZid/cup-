import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { notifyAdmin } from "@/lib/admin-notify";

/** Send a test notification to every registered admin device. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const sent = await notifyAdmin({
    kind: "test",
    title: "Beep Admin",
    body: "Notifications are working ✅",
    url: "/admin",
  });
  return NextResponse.json({ ok: true, sent });
}
