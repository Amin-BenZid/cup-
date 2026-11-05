"use client";

import { BellRing, Check, Loader2, Lock } from "lucide-react";
import Logo from "@/components/Logo";
import { useT } from "@/lib/i18n/context";

/**
 * Shown when the customer opens their order (after scanning the QR): one tap
 * turns on the sound and the lock-screen card (lib/lock-screen.ts), with a
 * preview of what the lock screen will show. "Later" closes it for this order;
 * the small "Enable sound" card stays on the page.
 */
export default function SoundSheet({
  orderNumber,
  shopName,
  logo,
  state,
  onEnable,
  onLater,
}: {
  orderNumber: string;
  shopName: string;
  logo: { url: string | null; scale?: number | null; offsetX?: number | null; offsetY?: number | null };
  state: "idle" | "loading" | "ok";
  onEnable: () => void;
  onLater: () => void;
}) {
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sound-sheet-title"
      data-testid="sound-sheet"
    >
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-[2px]" aria-hidden />

      <div
        className="relative w-full max-w-md rounded-3xl shadow-2xl p-5 space-y-5 animate-[sheetUp_.28s_ease-out]"
        style={{ background: "var(--surface, #fff)", color: "var(--text, #1c1917)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent-soft, #fef3c7)", color: "var(--accent, #b45309)" }}
          >
            <BellRing className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <h2 id="sound-sheet-title" className="text-lg font-bold leading-tight">
              {t("soundSheet.title")}
            </h2>
            <p className="text-sm leading-snug mt-0.5" style={{ color: "var(--text-muted, #78716c)" }}>
              {t("soundSheet.keep")}
            </p>
          </div>
        </div>

        {/* What the lock screen will look like */}
        <div
          className="rounded-2xl p-3 flex items-center gap-3 bg-stone-900/90 text-white"
          aria-hidden
          dir="auto"
        >
          <Logo
            url={logo.url}
            name={shopName}
            size={44}
            scale={Number(logo.scale ?? 1)}
            offsetX={Number(logo.offsetX ?? 0)}
            offsetY={Number(logo.offsetY ?? 0)}
            radius={10}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">
              {t("lock.preparing", { n: orderNumber })}
            </div>
            <div className="text-xs text-white/60 truncate">{shopName}</div>
          </div>
          <Lock className="w-4 h-4 text-white/50 shrink-0" />
        </div>

        <ul className="space-y-2.5 text-sm">
          <li className="flex items-center gap-2.5">
            <BellRing className="w-4 h-4 shrink-0" style={{ color: "var(--accent, #b45309)" }} />
            {t("soundSheet.ring")}
          </li>
          <li className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 shrink-0" style={{ color: "var(--accent, #b45309)" }} />
            {t("soundSheet.lock")}
          </li>
        </ul>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onEnable}
            disabled={state !== "idle"}
            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-90"
            style={
              state === "ok"
                ? { background: "#059669", color: "#fff" }
                : { background: "var(--primary, #1c1917)", color: "var(--primary-text, #fafaf9)" }
            }
          >
            {state === "loading" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : state === "ok" ? (
              <Check className="w-5 h-5" strokeWidth={3} />
            ) : (
              <BellRing className="w-5 h-5" />
            )}
            {state === "ok" ? t("cust.soundOn") : t("soundSheet.on")}
          </button>
          {state === "idle" && (
            // Doesn't start the sound: "Later" means later.
            <button
              type="button"
              onClick={onLater}
              data-lock-skip
              className="w-full py-2.5 text-sm font-medium"
              style={{ color: "var(--text-muted, #78716c)" }}
            >
              {t("soundSheet.later")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
