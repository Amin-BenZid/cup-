import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { countRecentErrors } from "@/lib/admin-errors";
import { DAY_MS, dayKey, deriveShopState, fetchAllRows, lastNDays } from "@/lib/admin-stats";
import { MONTHLY_PRICE_TND } from "@/lib/config";

type ShopLite = {
  id: string;
  name: string;
  code: string;
  status: string;
  created_at: string;
  logo_url: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  phone: string | null;
};

/** Everything the admin home screen needs, in one request. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const since14 = new Date(Date.now() - 14 * DAY_MS).toISOString();

    const [shopsRes, ordersRes, liveRes, unreadRes, historyRes, errors24h] =
      await Promise.all([
        fetchAllRows<ShopLite>((a, b) =>
          supabaseAdmin
            .from("shops")
            .select("id, name, code, status, created_at, logo_url, trial_ends_at, subscription_ends_at, phone")
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(a, b),
        ),
        fetchAllRows<{ created_at: string }>((a, b) =>
          supabaseAdmin
            .from("orders")
            .select("created_at")
            .gte("created_at", since14)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(a, b),
        ),
        supabaseAdmin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .neq("status", "done"),
        supabaseAdmin
          .from("support_messages")
          .select("shop_id, message, created_at, shops(name)")
          .eq("sender", "barista")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabaseAdmin
          .from("shop_history")
          .select("id, action, details, created_at, shop_id, shops(name)")
          .order("created_at", { ascending: false })
          .limit(12),
        countRecentErrors(24),
      ]);

    const shops = shopsRes.rows.map((s) => ({ ...s, ...deriveShopState(s) }));

    const pendingShops = shops
      .filter((s) => s.state === "pending")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => ({ id: s.id, name: s.name, code: s.code, created_at: s.created_at, logo_url: s.logo_url }));

    const expiring = shops
      .filter((s) => s.state === "expired" || (s.state === "active" && s.days_left <= 7))
      .sort((a, b) => a.days_left - b.days_left)
      .map((s) => ({
        id: s.id,
        name: s.name,
        state: s.state,
        days_left: s.days_left,
        is_trial: s.is_trial,
        phone: s.phone,
      }));

    // Group unread support messages by shop.
    type Unread = { shop_id: string; message: string; created_at: string; shops: { name: string } | { name: string }[] | null };
    const threads = new Map<string, { shop_id: string; shop_name: string; last_message: string; at: string; count: number }>();
    for (const m of (unreadRes.data ?? []) as Unread[]) {
      const shopName = Array.isArray(m.shops) ? m.shops[0]?.name : m.shops?.name;
      const t = threads.get(m.shop_id);
      if (t) t.count++;
      else
        threads.set(m.shop_id, {
          shop_id: m.shop_id,
          shop_name: shopName ?? "Unknown café",
          last_message: m.message,
          at: m.created_at,
          count: 1,
        });
    }

    const byDay: Record<string, number> = {};
    for (const o of ordersRes.rows) {
      const k = dayKey(o.created_at);
      byDay[k] = (byDay[k] ?? 0) + 1;
    }
    const days = lastNDays(14);
    const daily = days.map((d) => ({ day: d, count: byDay[d] ?? 0 }));
    const today = dayKey(Date.now());
    const last7 = days.slice(-7).reduce((a, d) => a + (byDay[d] ?? 0), 0);
    const prev7 = days.slice(0, 7).reduce((a, d) => a + (byDay[d] ?? 0), 0);

    const paying = shops.filter((s) => s.state === "active" && !s.is_trial).length;

    return NextResponse.json(
      {
        counts: {
          shops: shops.length,
          active: shops.filter((s) => s.state === "active").length,
          trial: shops.filter((s) => s.state === "active" && s.is_trial).length,
          paying,
          expired: shops.filter((s) => s.state === "expired").length,
          pending: pendingShops.length,
          unreadSupport: (unreadRes.data ?? []).length,
          errors24h,
          liveOrders: liveRes.count ?? 0,
          ordersToday: byDay[today] ?? 0,
          orders7d: last7,
          ordersPrev7d: prev7,
          mrr: paying * MONTHLY_PRICE_TND,
        },
        pendingShops,
        expiring,
        threads: [...threads.values()],
        daily,
        activity: (historyRes.data ?? []).map((h) => ({
          id: h.id,
          action: h.action,
          details: h.details,
          created_at: h.created_at,
          shop_id: h.shop_id,
          shop_name: (Array.isArray(h.shops) ? h.shops[0]?.name : (h.shops as { name?: string } | null)?.name) ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
