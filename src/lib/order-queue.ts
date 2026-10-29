import { supabaseAdmin } from "@/lib/supabase-admin";
import { estimateQueue, type HistoryRow, type QueueEstimate } from "@/lib/queue-estimate";
import { shopQueueTopic } from "@/lib/realtime";

/**
 * Live queue info for a customer's order page: the last order number the
 * shop served, how many orders are ahead, and an estimated ready time.
 * Server-only. Only order numbers and times are exposed, never ids or
 * phone numbers.
 */

export type OrderQueue = QueueEstimate & {
  last_served: { number: string; at: string } | null;
  /** Live channel pinged whenever any order of this shop changes. */
  topic: string;
};

// Orders still "preparing" after this long were almost always forgotten on
// the dashboard; they shouldn't make everyone else's estimate wrong.
const AHEAD_WINDOW_MS = 2 * 60 * 60 * 1000;
const HISTORY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LAST_SERVED_WINDOW_MS = 12 * 60 * 60 * 1000;

export async function getOrderQueue(
  shopId: string,
  order: { id: string; created_at: string },
  now = Date.now(),
): Promise<OrderQueue | null> {
  const [activeRes, historyRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, created_at")
      .eq("shop_id", shopId)
      .eq("status", "preparing")
      .gte("created_at", new Date(now - AHEAD_WINDOW_MS).toISOString())
      .limit(200),
    supabaseAdmin
      .from("orders")
      .select("order_number, created_at, ready_at")
      .eq("shop_id", shopId)
      .not("ready_at", "is", null)
      .gte("ready_at", new Date(now - HISTORY_WINDOW_MS).toISOString())
      .order("ready_at", { ascending: false })
      .limit(120),
  ]);
  if (activeRes.error || historyRes.error) return null;

  const mine = new Date(order.created_at).getTime();
  const ahead = (activeRes.data ?? []).filter(
    (o) => o.id !== order.id && new Date(o.created_at as string).getTime() < mine,
  ).length;

  const history = (historyRes.data ?? []) as (HistoryRow & { order_number: string })[];

  let last: (typeof history)[number] | null = null;
  for (const h of history) {
    if (!last || new Date(h.ready_at).getTime() > new Date(last.ready_at).getTime()) last = h;
  }
  const lastFresh = last && now - new Date(last.ready_at).getTime() <= LAST_SERVED_WINDOW_MS;

  return {
    ...estimateQueue({ now, createdAt: order.created_at, ahead, history }),
    last_served: last && lastFresh ? { number: String(last.order_number), at: last.ready_at } : null,
    topic: shopQueueTopic(shopId),
  };
}
