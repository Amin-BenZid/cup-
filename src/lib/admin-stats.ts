/** Shared helpers for admin APIs (server). Days are in Tunisia time. */

export const DAY_MS = 86_400_000;
const TZ = "Africa/Tunis";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

/** YYYY-MM-DD in Africa/Tunis. */
export function dayKey(d: string | number | Date): string {
  return fmt.format(new Date(d));
}

/** Last n day keys, oldest first, ending today. */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(Date.now() - i * DAY_MS));
  return out;
}

export type ShopState = "pending" | "active" | "expired" | "disabled";

export function deriveShopState(shop: {
  status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}) {
  const now = Date.now();
  const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : 0;
  const subEnd = shop.subscription_ends_at ? new Date(shop.subscription_ends_at).getTime() : 0;
  const trialOk = trialEnd > now;
  const subOk = subEnd > now;
  let state: ShopState = "active";
  if (shop.status === "pending") state = "pending";
  else if (shop.status === "disabled") state = "disabled";
  else if (!trialOk && !subOk) state = "expired";
  return {
    state,
    days_left: Math.max(0, Math.ceil((Math.max(trialEnd, subEnd) - now) / DAY_MS)),
    is_trial: !subOk && trialOk,
  };
}

/** Prep time in seconds, ignoring obviously broken rows (>6 h or negative). */
export function prepSeconds(o: { created_at: string; ready_at: string | null }) {
  if (!o.ready_at) return null;
  const s = (new Date(o.ready_at).getTime() - new Date(o.created_at).getTime()) / 1000;
  return s >= 0 && s < 6 * 3600 ? s : null;
}

export function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Fetch every row of a query in pages (Supabase caps responses at 1000 rows
 * by default, regardless of .limit()). `build(from, to)` must apply a stable
 * order and `.range(from, to)`. Stops at `max` rows.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => Page<T>,
  max = 50_000,
  pageSize = 1000,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build(from, Math.min(from + pageSize, max) - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
