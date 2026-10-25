import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  beginEnrolment,
  confirmEnrolment,
  disableTwoFactor,
  twoFactorStatus,
  verifyAdminCode,
} from "@/lib/admin-2fa";
import { logAdminEvent } from "@/lib/admin-audit";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await twoFactorStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * { action: "begin" }                 → { secret, uri } (pending, 15 min)
 * { action: "confirm", code }         → enables 2FA
 * { action: "disable", code }         → disables 2FA (needs a current code)
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const code = String(body?.code ?? "");
    const status = await twoFactorStatus();

    if (action === "begin") {
      if (status.enabled) {
        return NextResponse.json({ error: "2FA is already on. Turn it off first." }, { status: 409 });
      }
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "cup";
      const { secret, uri } = await beginEnrolment(`admin@${host}`);
      return NextResponse.json(
        { secret, uri },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (action === "confirm") {
      if (status.enabled) {
        return NextResponse.json({ error: "2FA is already on." }, { status: 409 });
      }
      const ok = await confirmEnrolment(code);
      await logAdminEvent(req, "2fa_enabled", undefined, ok);
      if (!ok) {
        return NextResponse.json(
          { error: "Code didn't match. Check the time on your phone and try a fresh code." },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "disable") {
      if (!status.enabled) return NextResponse.json({ ok: true });
      const ok = await verifyAdminCode(code);
      await logAdminEvent(req, "2fa_disabled", undefined, ok);
      if (!ok) {
        return NextResponse.json({ error: "Wrong code" }, { status: 400 });
      }
      await disableTwoFactor();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
