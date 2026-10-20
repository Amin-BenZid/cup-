import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
  createSessionToken,
} from "@/lib/admin-auth";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Best effort: one Map per serverless instance. Not shared across regions and
// lost on cold start, but it turns unlimited brute force into a slow one.
const attempts = new Map<string, { count: number; resetAt: number }>();

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
  const now = Date.now();
  const record = attempts.get(key);

  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = (body?.password ?? "").toString();

  if (!safeEqual(password, expected)) {
    const count = record && record.resetAt > now ? record.count + 1 : 1;
    attempts.set(key, { count, resetAt: now + WINDOW_MS });
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  attempts.delete(key);

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