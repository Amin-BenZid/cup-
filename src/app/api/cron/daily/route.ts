import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { notifyAdmin } from "@/lib/admin-notify";

/**
 * Daily job (Vercel Cron, see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set this route
 * refuses to run.
 *
 * Sends one summary push: shops whose trial/subscription ends within 3 days,
 * shops that expired in the last 24 h, and cafés still waiting for approval.
 */

const DAY = 24 * 60 * 60 * 1000;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("shops")
      .select("id, name, status, trial_ends_at, subscription_ends_at");
    if (error) throw error;

    const now = Date.now();
    const endingSoon: string[] = [];
    const justExpired: string[] = [];
    let pending = 0;

    for (const s of data ?? []) {
      if (s.status === "pending") {
        pending++;
        continue;
      }
      if (s.status !== "active") continue;
      const end = Math.max(
        s.trial_ends_at ? new Date(s.trial_ends_at).getTime() : 0,
        s.subscription_ends_at ? new Date(s.subscription_ends_at).getTime() : 0,
      );
      if (end > now && end - now <= 3 * DAY) endingSoon.push(s.name);
      else if (end <= now && now - end <= DAY) justExpired.push(s.name);
    }

    const parts: string[] = [];
    if (justExpired.length) parts.push(`Expired: ${justExpired.join(", ")}`);
    if (endingSoon.length) parts.push(`Ending ≤3 days: ${endingSoon.join(", ")}`);
    if (pending) parts.push(`${pending} waiting for approval`);

    let sent = 0;
    if (parts.length) {
      sent = await notifyAdmin({
        kind: "billing",
        title: "Beep daily check",
        body: parts.join(" · ").slice(0, 240),
        url: "/admin/billing",
      });
    }

    return NextResponse.json({
      ok: true,
      endingSoon: endingSoon.length,
      justExpired: justExpired.length,
      pending,
      sent,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    console.error("[cron daily]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
