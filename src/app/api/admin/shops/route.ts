import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { deriveShopState } from "@/lib/admin-stats";
import { MONTHLY_PRICE_TND } from "@/lib/config";

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
  code: string;
  has_created_order: boolean | null;
  locked_until: string | null;
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

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [shopsRes, statsRes] = await Promise.all([
    supabaseAdmin
      .from("shops")
      .select(
        "id, name, tagline, status, created_at, logo_url, theme, game, trial_ends_at, subscription_ends_at, billing_status, phone, paid_current_month, code, has_created_order, locked_until",
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

    const { state, days_left: daysLeft, is_trial } = deriveShopState(s);
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
      is_trial,
      days_left: daysLeft,
      locked: !!s.locked_until && new Date(s.locked_until).getTime() > now,
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
        pending: shops.filter((s) => s.status === "pending").length,
        payingShops: shops.filter((s) => s.status === "active" && !s.is_trial).length,
        mrr: shops.filter((s) => s.status === "active" && !s.is_trial).length * MONTHLY_PRICE_TND,
        avgRating: ratingCount ? (ratingSum / ratingCount).toFixed(1) : "0.0",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}