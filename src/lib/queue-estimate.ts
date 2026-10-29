/**
 * Wait-time estimate for a customer's order, from the shop's own history.
 * Pure (no I/O) so it can be unit-tested; see src/lib/order-queue.ts.
 *
 * Two numbers drive it:
 * - prep: how long one order takes, from "received" to "ready".
 * - gap: how often the shop finishes an order when it's busy (time between
 *   two consecutive "ready" taps). Shops often make several orders at once,
 *   so the gap is usually shorter than the prep time; using it for the
 *   orders ahead is what keeps the estimate honest during a rush.
 *
 * Estimated ready time = the later of
 *   (a) my order's received time + prep, and
 *   (b) now + orders ahead × gap.
 * Last 2 hours are used when there are enough of them (it reflects the
 * current rush and staffing), otherwise the last 14 days.
 */

export type HistoryRow = { created_at: string; ready_at: string };

export type QueueEstimate = {
  /** Server clock when this was computed (ISO): the client corrects skew. */
  now: string;
  ahead: number;
  eta_at: string;
  eta_low_at: string;
  eta_high_at: string;
  /** Typical prep time at this shop, seconds. */
  typical_s: number;
  samples: number;
  confidence: "high" | "medium" | "low";
};

const MIN_PREP_S = 15;
const MAX_PREP_S = 90 * 60;
const IDLE_GAP_S = 20 * 60; // a longer gap means the shop was quiet, not slow
const RECENT_MS = 2 * 60 * 60 * 1000;
const MAX_SAMPLES = 40;

export const DEFAULT_PREP_S = 5 * 60;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const ms = (iso: string) => new Date(iso).getTime();

export function estimateQueue(input: {
  now: number;
  createdAt: string;
  ahead: number;
  history: HistoryRow[];
}): QueueEstimate {
  const { now } = input;
  const created = ms(input.createdAt);
  const ahead = Math.max(0, Math.floor(input.ahead));

  // Valid finished orders, newest "ready" first.
  const rows = input.history
    .map((r) => ({ c: ms(r.created_at), r: ms(r.ready_at) }))
    .filter((x) => Number.isFinite(x.c) && Number.isFinite(x.r) && x.r <= now + 60_000)
    .map((x) => ({ ...x, d: (x.r - x.c) / 1000 }))
    .filter((x) => x.d >= MIN_PREP_S && x.d <= MAX_PREP_S)
    .sort((a, b) => b.r - a.r);

  const recent = rows.filter((x) => now - x.r <= RECENT_MS);
  const pool = (recent.length >= 5 ? recent : rows).slice(0, MAX_SAMPLES);

  const preps = pool.map((x) => x.d).sort((a, b) => a - b);
  const n = preps.length;

  // Gaps between consecutive "ready" taps, ignoring quiet periods.
  const byReady = rows.slice(0, MAX_SAMPLES + 1);
  const gaps: number[] = [];
  for (let i = 0; i + 1 < byReady.length; i++) {
    const g = (byReady[i].r - byReady[i + 1].r) / 1000;
    if (g >= 0 && g <= IDLE_GAP_S) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);

  let prep: number, prepLo: number, prepHi: number;
  if (n >= 3) {
    prep = quantile(preps, 0.5);
    prepLo = quantile(preps, 0.25);
    prepHi = quantile(preps, 0.75);
  } else {
    // New shop: a sensible default, nudged by whatever we have.
    const seen = n ? quantile(preps, 0.5) : DEFAULT_PREP_S;
    prep = (DEFAULT_PREP_S + seen * n) / (1 + n);
    prepLo = prep * 0.75;
    prepHi = prep * 1.4;
  }

  let gap: number, gapLo: number, gapHi: number;
  if (gaps.length >= 3) {
    // Never longer than one full prep (that would mean one-at-a-time at most)
    // and never under 20 s (a burst of taps isn't real throughput).
    const clamp = (v: number) => Math.min(Math.max(v, 20), prep);
    gap = clamp(quantile(gaps, 0.5));
    gapLo = clamp(quantile(gaps, 0.25));
    gapHi = clamp(quantile(gaps, 0.75));
  } else {
    gap = prep * 0.6;
    gapLo = prep * 0.4;
    gapHi = prep * 0.8;
  }

  // With nobody ahead the estimate stays put (it may pass): the page then
  // says "any moment" / "taking longer", rather than an endless 0:00.
  const at = (p: number, g: number) =>
    ahead > 0 ? Math.max(created + p * 1000, now + ahead * g * 1000) : created + p * 1000;
  const eta = at(prep, gap);
  const lo = Math.min(at(prepLo, gapLo), eta);
  const hi = Math.max(at(prepHi, gapHi), eta);

  return {
    now: new Date(now).toISOString(),
    ahead,
    eta_at: new Date(eta).toISOString(),
    eta_low_at: new Date(lo).toISOString(),
    eta_high_at: new Date(hi).toISOString(),
    typical_s: Math.round(prep),
    samples: n,
    confidence: n >= 15 ? "high" : n >= 5 ? "medium" : "low",
  };
}
