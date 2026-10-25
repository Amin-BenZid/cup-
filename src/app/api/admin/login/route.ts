import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  clientIp,
  createSessionToken,
  setAdminCookie,
} from "@/lib/admin-auth";
import { isTwoFactorEnabled, verifyAdminCode } from "@/lib/admin-2fa";
import { logAdminEvent } from "@/lib/admin-audit";
import { createRateLimiter } from "@/lib/rate-limit";

// 5 failed attempts per IP per 15 min, shared across all instances.
const limiter = createRateLimiter("admin_login", 5, 15 * 60 * 1000);

function safeEqual(a: string, b: string) {
  // Hash first so lengths match and timing doesn't leak the password length.
  const A = crypto.createHash("sha256").update(a).digest();
  const B = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(A, B);
}

/** Tells the login form whether to show the 2FA code field. */
export async function GET() {
  try {
    return NextResponse.json(
      { twoFactor: await isTwoFactorEnabled() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // If we can't tell, ask for the code: the server will enforce anyway.
    return NextResponse.json({ twoFactor: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "ADMIN_PASSWORD not set on server" },
        { status: 500 },
      );
    }

    const ip = clientIp(req);

    if (await limiter.isBlocked(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = (body?.password ?? "").toString();
    const code = (body?.code ?? "").toString();

    const passwordOk = safeEqual(password, expected);
    const needs2fa = await isTwoFactorEnabled();
    // Only consume/verify the code once the password is right, so a wrong
    // password can't burn a valid code.
    const codeOk = !needs2fa || (passwordOk && (await verifyAdminCode(code)));

    if (!passwordOk || !codeOk) {
      await limiter.fail(ip);
      await logAdminEvent(req, "login_failed", { reason: !passwordOk ? "password" : "2fa" }, false);
      return NextResponse.json(
        {
          error: needs2fa ? "Wrong password or code" : "Wrong password",
          twoFactor: needs2fa,
        },
        { status: 401 },
      );
    }

    await limiter.reset(ip);
    await logAdminEvent(req, "login", { twoFactor: needs2fa });

    const res = NextResponse.json({ ok: true });
    setAdminCookie(res, await createSessionToken());
    return res;
  } catch (e) {
    console.error("[admin login]", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
