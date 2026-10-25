import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminCookie,
  requireAdmin,
  revokeAllAdminSessions,
} from "@/lib/admin-auth";
import { logAdminEvent } from "@/lib/admin-audit";

/** 200 when the admin cookie is valid, 401 otherwise. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

/** Log out every device (revokes all admin sessions, including this one). */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await revokeAllAdminSessions();
    await logAdminEvent(req, "logout_all_devices");
    const res = NextResponse.json({ ok: true });
    clearAdminCookie(res);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
