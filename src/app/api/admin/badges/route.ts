import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { countRecentErrors } from "@/lib/admin-errors";

/** Cheap counters for the admin nav badges (polled every ~30 s). */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const [pendingRes, unreadRes, errors24h] = await Promise.all([
      supabaseAdmin
        .from("shops")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabaseAdmin
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender", "barista")
        .eq("is_read", false),
      countRecentErrors(24),
    ]);

    return NextResponse.json(
      {
        pending: pendingRes.count ?? 0,
        unreadSupport: unreadRes.count ?? 0,
        errors24h,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
