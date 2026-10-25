import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
  createSessionToken,
} from "@/lib/admin-auth";
import { createRateLimiter } from "@/lib/rate-limit";

// 5 failed attempts per IP per 15 min, shared across all instances.
const limiter = createRateLimiter("admin_login", 5, 15 * 60 * 1000);

function keyFor(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not set on server" },
      { status: 500 },
    );
  }

  const key = keyFor(req);

  if (await limiter.isBlocked(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = (body?.password ?? "").toString();

  if (!safeEqual(password, expected)) {
    await limiter.fail(key);
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  await limiter.reset(key);

  const token = createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_MAX_AGE,
    path: "/",
  });
  return res;
}