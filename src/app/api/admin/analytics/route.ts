import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { avg, DAY_MS, dayKey, fetchAllRows, lastNDays, prepSeconds } from "@/lib/admin-stats";

/** GET /api/admin/analytics?days=7|30|90 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const raw = Number(req.nextUrl.searchParams.get("days"));
    const days = [7, 30, 90].includes(raw) ? raw : 30;
    const since = new Date(Date.now() - days * DAY_MS).toISOString();

    type O = { shop_id: string; created_at: string; ready_at: string | null; customer_connected: boolean };
    type R = { shop_id: string; rating: number; created_at: string };
    type S = { id: string; name: string; created_at: string; logo_url: string | null };

    const [ordersRes, reviewsRes, shopsRes] = await Promise.all([
      fetchAllRows<O>((a, b) =>
        supabaseAdmin
          .from("orders")
          .select("shop_id, created_at, ready_at, customer_connected")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(a, b),
      ),
      fetchAllRows<R>((a, b) =>
        supabaseAdmin
          .from("reviews")
          .select("shop_id, rating, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .order("order_id", { ascending: true })
          .range(a, b),
      ),
      fetchAllRows<S>((a, b) =>
        supabaseAdmin
          .from("shops")
          .select("id, name, created_at, logo_url")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(a, b),
      ),
    ]);

    const orders = ordersRes.rows;
    const reviews = reviewsRes.rows;
    const shops = shopsRes.rows;
    const keys = lastNDays(days);

    // Per-day series
    const dayOrders: Record<string, number> = {};
    const dayPrep: Record<string, number[]> = {};
    for (const o of orders) {
      const k = dayKey(o.created_at);
      dayOrders[k] = (dayOrders[k] ?? 0) + 1;
      const p = prepSeconds(o);
      if (p !== null) (dayPrep[k] ??= []).push(p);
    }
    const daySignups: Record<string, number> = {};
    for (const s of shops) {
      if (s.created_at >= since) {
        const k = dayKey(s.created_at);
        daySignups[k] = (daySignups[k] ?? 0) + 1;
      }
    }

    // Hour-of-day (Tunisia) distribution
    const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Tunis", hour: "2-digit", hourCycle: "h23" });
    const hours = Array.from({ length: 24 }, () => 0);
    for (const o of orders) hours[Number(hourFmt.format(new Date(o.created_at))) % 24]++;

    // Per-shop leaderboard
    const perShop = new Map<string, { orders: number; prep: number[]; connected: number; ratings: number[] }>();
    for (const o of orders) {
      const e = perShop.get(o.shop_id) ?? { orders: 0, prep: [], connected: 0, ratings: [] };
      e.orders++;
      const p = prepSeconds(o);
      if (p !== null) e.prep.push(p);
      if (o.customer_connected) e.connected++;
      perShop.set(o.shop_id, e);
    }
    for (const r of reviews) {
      const e = perShop.get(r.shop_id) ?? { orders: 0, prep: [], connected: 0, ratings: [] };
      e.ratings.push(r.rating);
      perShop.set(r.shop_id, e);
    }
    const shopName = new Map(shops.map((s) => [s.id, s]));
    const leaderboard = [...perShop.entries()]
      .map(([id, e]) => ({
        shop_id: id,
        name: shopName.get(id)?.name ?? "Deleted café",
        logo_url: shopName.get(id)?.logo_url ?? null,
        orders: e.orders,
        avgPrepSec: e.prep.length ? Math.round(avg(e.prep)!) : null,
        connectRate: e.orders ? Math.round((e.connected / e.orders) * 100) : null,
        rating: e.ratings.length ? Math.round(avg(e.ratings)! * 10) / 10 : null,
        reviews: e.ratings.length,
      }))
      .sort((a, b) => b.orders - a.orders);

    const allPrep = orders.map(prepSeconds).filter((x): x is number => x !== null);
    const ratingDist = [1, 2, 3].map((r) => reviews.filter((x) => x.rating === r).length);

    return NextResponse.json(
      {
        days,
        totals: {
          orders: orders.length,
          avgPerDay: Math.round((orders.length / days) * 10) / 10,
          avgPrepSec: allPrep.length ? Math.round(avg(allPrep)!) : null,
          connectRate: orders.length
            ? Math.round((orders.filter((o) => o.customer_connected).length / orders.length) * 100)
            : null,
          reviews: reviews.length,
          avgRating: reviews.length ? Math.round(avg(reviews.map((r) => r.rating))! * 10) / 10 : null,
          signups: Object.values(daySignups).reduce((a, b) => a + b, 0),
          activeShops: leaderboard.filter((l) => l.orders > 0).length,
        },
        series: keys.map((k) => ({
          day: k,
          orders: dayOrders[k] ?? 0,
          signups: daySignups[k] ?? 0,
          avgPrepSec: dayPrep[k]?.length ? Math.round(avg(dayPrep[k])!) : null,
        })),
        hours,
        ratingDist,
        leaderboard,
        truncated: ordersRes.truncated || reviewsRes.truncated,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
