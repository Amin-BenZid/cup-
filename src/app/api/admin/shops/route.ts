import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isAdminAuthed } from "@/lib/admin-auth";

type ShopRow = {
  id: string;
  name: string;
  tagline: string | null;
  status: string;
  created_at: string;
  logo_url: string | null;
  theme: unknown;
  game: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  billing_status: string | null;
  phone: string | null;
  paid_current_month: boolean | null;
};

type StatRow = {
  shop_id: string;
  orders_total: number;
  orders_7d: number;
  orders_30d: number;
  orders_today: number;
  last_order_at: string | null;
  rating_avg: number;
  rating_count: number;
};

const DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [shopsRes, statsRes] = await Promise.all([
    supabaseAdmin
      .from("shops")
      .select(
        "id, name, tagline, status, created_at, logo_url, theme, game, trial_ends_at, subscription_ends_at, billing_status, phone, paid_current_month",
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.rpc("admin_shop_stats"),
  ]);

  if (shopsRes.error) {
    return NextResponse.json({ error: shopsRes.error.message }, { status: 500 });
  }

  const statMap = new Map<string, StatRow>(
    ((statsRes.data as StatRow[] | null) ?? []).map((r) => [r.shop_id, r]),
  );

  const now = Date.now();
  let totalOrders = 0;
  let ordersToday = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  const shops = ((shopsRes.data as ShopRow[] | null) ?? []).map((s) => {
    const st = statMap.get(s.id);

    const trialEnd = s.trial_ends_at ? new Date(s.trial_ends_at).getTime() : 0;
    const subEnd = s.subscription_ends_at
      ? new Date(s.subscription_ends_at).getTime()
      : 0;

    const trialOk = trialEnd > now;
    const subOk = subEnd > now;

    // Derived state — the raw column only knows pending/active/disabled.
    let state: "pending" | "disabled" | "expired" | "active" = "active";
    if (s.status === "pending") state = "pending";
    else if (s.status === "disabled") state = "disabled";
    else if (!trialOk && !subOk) state = "expired";

    const periodEnd = Math.max(subEnd, trialEnd);
    const daysLeft = Math.max(0, Math.ceil((periodEnd - now) / DAY));

    const stats = {
      total: Number(st?.orders_total ?? 0),
      last7: Number(st?.orders_7d ?? 0),
      last30: Number(st?.orders_30d ?? 0),
      today: Number(st?.orders_today ?? 0),
      last_order_at: st?.last_order_at ?? null,
      rating: Number(st?.rating_avg ?? 0),
      rating_count: Number(st?.rating_count ?? 0),
    };

    totalOrders += stats.total;
    ordersToday += stats.today;
    ratingSum += stats.rating * stats.rating_count;
    ratingCount += stats.rating_count;

    return {
      ...s,
      status: state,
      raw_status: s.status,
      is_trial: !subOk && trialOk,
      days_left: daysLeft,
      stats,
    };
  });

  return NextResponse.json(
    {
      shops,
      globalStats: {
        totalOrders,
        ordersToday,
        totalShops: shops.length,
        activeShops: shops.filter((s) => s.status === "active").length,
        expiringSoon: shops.filter(
          (s) => s.status === "active" && s.days_left <= 7,
        ).length,
        totalReviews: ratingCount,
        avgRating: ratingCount ? (ratingSum / ratingCount).toFixed(1) : "0.0",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}