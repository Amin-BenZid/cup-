import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Admin session cookie: `v2.<issuedMs>.<version>.<hmac>`.
 *
 * - HMAC-SHA256 with ADMIN_SECRET, 7-day lifetime.
 * - `version` must match `global_settings.admin_session_version`. Bumping that
 *   number ("Log out all devices") revokes every existing admin session.
 * - Mutating requests must also come from our own origin (CSRF defence on top
 *   of SameSite=Lax).
 */

const COOKIE_NAME = "admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const VERSION_KEY = "admin_session_version";
const VERSION_CACHE_MS = 15_000;

let versionCache: { value: number; at: number } | null = null;

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET not set");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

async function currentVersion(): Promise<number | null> {
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_CACHE_MS) {
    return versionCache.value;
  }
  try {
    const v = await getSetting<number>(VERSION_KEY);
    const value = typeof v === "number" && Number.isFinite(v) ? v : 0;
    versionCache = { value, at: now };
    return value;
  } catch {
    // DB unreachable: fall back to the last known value, otherwise deny.
    return versionCache?.value ?? null;
  }
}

/** Revoke all admin sessions (including the caller's). */
export async function revokeAllAdminSessions(): Promise<number> {
  const v = (await currentVersion()) ?? 0;
  const next = v + 1;
  await setSetting(VERSION_KEY, next);
  versionCache = { value: next, at: Date.now() };
  return next;
}

export async function createSessionToken(): Promise<string> {
  const version = (await currentVersion()) ?? 0;
  const payload = `v2.${Date.now()}.${version}`;
  return `${payload}.${sign(payload)}`;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v2") return false;
  const [, issued, version, sig] = parts;
  const expected = sign(`v2.${issued}.${version}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt)) return false;
  if ((Date.now() - issuedAt) / 1000 >= MAX_AGE_SECONDS) return false;

  const current = await currentVersion();
  if (current === null) return false;
  return Number(version) === current;
}

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Browsers always send Origin on fetch() POST/PATCH/DELETE. If it's absent
  // (non-browser client) the SameSite=Lax cookie still protects us.
  if (!origin) return true;
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Guard for every admin API route. Returns a response to send back when the
 * caller is not allowed, or null when they are.
 *
 *   const denied = await requireAdmin(req); if (denied) return denied;
 */
export async function requireAdmin(req?: Request): Promise<NextResponse | null> {
  if (req && !["GET", "HEAD"].includes(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function setAdminCookie(res: NextResponse, token: string) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_MAX_AGE = MAX_AGE_SECONDS;
