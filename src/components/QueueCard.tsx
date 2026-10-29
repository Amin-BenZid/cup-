"use client";

import { useEffect, useState } from "react";
import { Sparkles, Users, BellRing } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import type { OrderQueue } from "@/lib/order-queue";

/** Queue info plus how far the phone's clock is from the server's. */
export type QueueState = { q: OrderQueue; skew: number };

/**
 * Keep the countdown steady: a fresh estimate within 20 s of the one on
 * screen doesn't move the timer (that would look jumpy), anything bigger does.
 */
export function mergeQueue(prev: QueueState | null, next: QueueState): QueueState {
  if (!prev) return next;
  const drift = Math.abs(Date.parse(next.q.eta_at) - Date.parse(prev.q.eta_at));
  if (drift < 20_000 && prev.q.ahead === next.q.ahead) {
    return { q: { ...next.q, eta_at: prev.q.eta_at, eta_low_at: prev.q.eta_low_at, eta_high_at: prev.q.eta_high_at }, skew: prev.skew };
  }
  return next;
}

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

function clock(totalS: number): string {
  const s = Math.max(0, Math.ceil(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

const RING = 168;
const STROKE = 10;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function QueueCard({ state, createdAt }: { state: QueueState; createdAt: string }) {
  const t = useT();
  const localNow = useNow();
  const { q, skew } = state;

  // Server-side "now" on this phone; null until mounted (no hydration drift).
  const now = localNow === null ? Date.parse(q.now) : localNow + skew;
  const mounted = localNow !== null;

  const created = Date.parse(createdAt);
  const eta = Date.parse(q.eta_at);
  const remainingS = (eta - now) / 1000;
  const overrunS = -remainingS;
  const progress = Math.min(1, Math.max(0, (now - created) / Math.max(1, eta - created)));

  const lowMin = Math.max(1, Math.round((Date.parse(q.eta_low_at) - now) / 60000));
  const highMin = Math.max(lowMin, Math.round((Date.parse(q.eta_high_at) - now) / 60000));
  const showRange = remainingS > 30 && Date.parse(q.eta_high_at) > now;

  const phase: "counting" | "any" | "late" =
    remainingS > 0 ? "counting" : overrunS < 120 ? "any" : "late";

  const lastAgoMin = q.last_served
    ? Math.max(0, Math.floor((now - Date.parse(q.last_served.at)) / 60000))
    : 0;

  const dots = Math.min(q.ahead, 6);
  const more = q.ahead - dots;

  return (
    <div
      className="rounded-3xl border p-5 space-y-5 text-center"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      data-testid="queue-card"
    >
      {/* Countdown ring */}
      <div className="relative mx-auto" style={{ width: RING, height: RING }}>
        <svg width={RING} height={RING} className="-rotate-90" aria-hidden>
          <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
            className={phase === "counting" ? "" : "animate-pulse"}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          {phase === "counting" ? (
            <>
              <div
                className="text-4xl font-bold tabular-nums leading-none"
                data-testid="queue-countdown"
                suppressHydrationWarning
              >
                {mounted ? clock(remainingS) : clock((eta - Date.parse(q.now)) / 1000)}
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                {t("queue.left")}
              </div>
            </>
          ) : (
            <>
              <BellRing className="w-7 h-7 mb-1.5 animate-bounce" style={{ color: "var(--accent)" }} />
              <div className="text-base font-bold leading-tight">
                {phase === "any" ? t("queue.anyMoment") : t("queue.almost")}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1 -mt-1">
        {phase === "counting" && showRange && (
          <p className="text-sm font-semibold">
            {lowMin === highMin
              ? t("queue.rangeOne", { n: lowMin })
              : t("queue.range", { low: lowMin, high: highMin })}
          </p>
        )}
        {phase === "late" && (
          <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
            {t("queue.longer")}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl px-3 py-3" style={{ background: "var(--accent-soft)" }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
            {t("queue.lastServed")}
          </div>
          <div className="text-2xl font-bold tabular-nums mt-0.5 break-all" data-testid="queue-last">
            {q.last_served ? `#${q.last_served.number}` : "—"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }} suppressHydrationWarning>
            {!q.last_served
              ? t("queue.noneYet")
              : lastAgoMin < 1
                ? t("queue.justNow")
                : t("queue.agoMin", { n: lastAgoMin })}
          </div>
        </div>
        <div className="rounded-2xl px-3 py-3" style={{ background: "var(--accent-soft)" }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
            {t("queue.ahead")}
          </div>
          <div className="text-2xl font-bold tabular-nums mt-0.5" data-testid="queue-ahead">
            {q.ahead}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {q.ahead === 0 ? t("queue.youreNext") : t("queue.ordersSub")}
          </div>
        </div>
      </div>

      {/* Line: orders ahead, then you */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap" aria-hidden>
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={`w-7 h-7 rounded-full flex items-center justify-center ${i === 0 ? "animate-pulse" : ""}`}
            style={{ background: "var(--border)", color: "var(--text-muted)" }}
          >
            <Users className="w-3.5 h-3.5" />
          </span>
        ))}
        {more > 0 && (
          <span className="text-xs font-semibold px-1" style={{ color: "var(--text-muted)" }}>
            +{more}
          </span>
        )}
        <span
          className="h-7 px-3 rounded-full text-xs font-bold flex items-center gap-1"
          style={{ background: "var(--primary)", color: "var(--primary-text)" }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t("queue.you")}
        </span>
      </div>

      <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
        {q.confidence === "low" ? t("queue.rough") : t("queue.basedOn", { n: q.samples })}
      </p>
    </div>
  );
}
