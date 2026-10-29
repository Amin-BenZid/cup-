"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Coffee,
  Check,
  BellRing,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import NotificationSetup from "@/components/NotificationSetup";
import { useStored } from "@/hooks/useStored";
import Logo from "@/components/Logo";
import BrandLogo from "@/components/BrandLogo";
import CozyPattern from "@/components/CozyPattern";
import ReviewPrompt from "@/components/ReviewPrompt";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/context";
import { setBadge, clearBadge } from "@/lib/badge";
import { useElapsed, formatElapsed } from "@/hooks/useElapsed";
import { getFont, getPalette, paletteVars, type Shop } from "@/lib/themes";
import { useLiveTopic } from "@/lib/realtime-client";

// The game is below the fold and heavy — keep it out of the first JS payload.
const CatchBeans = dynamic(() => import("@/components/CatchBeans"), {
  ssr: false,
});

export type Order = {
  id: string;
  order_number: string;
  status: "preparing" | "ready" | "done";
  customer_connected: boolean;
  created_at: string;
  ready_at: string | null;
};

type Props = {
  orderId: string;
  initialOrder?: Order | null;
  initialShop?: Shop | null;
  /** Live channel for this order (from the server render). */
  topic?: string | null;
};

export default function CustomerOrderClient({
  orderId,
  initialOrder,
  initialShop,
  topic: initialTopic,
}: Props) {
  const t = useT();
  const router = useRouter();
  const hasInitial = initialOrder !== undefined;

  const [order, setOrder] = useState<Order | null>(initialOrder ?? null);
  const [shop, setShop] = useState<Shop | null>(initialShop ?? null);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState(
    hasInitial && !initialOrder ? t("common.orderNotFound") : "",
  );
  // A server-delivered order that's already ready rings from the start
  // (unless it was acknowledged on this phone, see `acknowledged`).
  const [ringing, setRinging] = useState(
    () => !!hasInitial && initialOrder?.status === "ready",
  );
  const [topic, setTopic] = useState<string | null>(initialTopic ?? null);
  const [ackNow, setAcknowledged] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [enableState, setEnableState] = useState<
    "idle" | "loading" | "ok" | "hidden"
  >("idle");
  // Acknowledged on this phone earlier (saved), or just now.
  const ackSaved = useStored(orderId ? `cup-ack-${orderId}` : null) === "1";
  const acknowledged = ackNow || ackSaved;
  // Once any tap has unlocked sound, the "enable sound" prompt goes away.
  const soundPrompt =
    audioUnlocked && enableState === "idle" ? "hidden" : enableState;
  const [staleDismissed, setStaleDismissed] = useState(false);
  const [staleCancelling, setStaleCancelling] = useState(false);
  const [staleError, setStaleError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // ---------- audio engine ----------
  // Web Audio instead of <audio>.play(): once an AudioContext is resumed inside
  // a user gesture, later playback is allowed without another gesture, on iOS
  // and Android. Unlocking is silent, so it never fires the alert.
  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, []);

  const startAudio = useCallback(async () => {
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (ctx && buffer && ctx.state !== "closed") {
      try {
        if (ctx.state === "suspended") await ctx.resume();
        if (!sourceRef.current) {
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.loop = true;
          src.connect(ctx.destination);
          src.start(0);
          sourceRef.current = src;
        }
        return true;
      } catch {
        // fall through to the element fallback
      }
    }
    const el = audioRef.current;
    if (el) {
      try {
        el.loop = true;
        el.volume = 1;
        await el.play();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const unlockAudio = useCallback(async () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        const w = window as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) throw new Error("no AudioContext");
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (!audioBufferRef.current) {
        const res = await fetch("/ready.mp3", { cache: "force-cache" });
        const bytes = await res.arrayBuffer();
        audioBufferRef.current = await ctx.decodeAudioData(bytes.slice(0));
      }
      setAudioUnlocked(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleEnableSound = useCallback(async () => {
    if (enableState === "loading") return;
    setEnableState("loading");
    const ok = await unlockAudio();
    if (ok) {
      setEnableState("ok");
      if (navigator.vibrate) navigator.vibrate(10);
      window.setTimeout(() => setEnableState("hidden"), 1600);
    } else {
      setEnableState("idle");
    }
  }, [enableState, unlockAudio]);

  // ---------- initial load ----------
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    // The server already delivered the order — only register the connection.
    if (hasInitial) {
      if (initialOrder) {
        try {
          localStorage.setItem("cup-active-order", orderId);
        } catch {}
        fetch(`/api/orders/${orderId}/connect`, { method: "POST" }).catch(
          () => {},
        );
      }
      return;
    }

    async function load() {
      try {
        const res = await fetch(`/api/o/${orderId}`, { cache: "no-store" });

        if (cancelled) return;

        if (res.status === 404) {
          setError(t("common.orderNotFound"));
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError(t("common.loadFailed"));
          setLoading(false);
          return;
        }

        const json = await res.json();
        const orderData = json.order as Order;
        if (!orderData) {
          setError(t("common.orderNotFound"));
          setLoading(false);
          return;
        }

        setOrder(orderData);
        setLoading(false);
        if (json.shop) setShop(json.shop as Shop);
        if (typeof json.topic === "string") setTopic(json.topic);

        try {
          localStorage.setItem("cup-active-order", orderId);
        } catch {}

        fetch(`/api/orders/${orderId}/connect`, { method: "POST" }).catch(
          () => {},
        );

        try {
          const ack = localStorage.getItem(`cup-ack-${orderId}`);
          if (orderData.status === "ready" && ack !== "1") setRinging(true);
        } catch {}
      } catch {
        if (!cancelled) {
          setError(t("common.loadFailed"));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, hasInitial, initialOrder, t]);

  // A finished or already-acknowledged order must never re-open the "enjoy"
  // screen. Runs once, on the first order we receive.
  const initialRedirectDone = useRef(false);
  useEffect(() => {
    if (!order || initialRedirectDone.current) return;
    initialRedirectDone.current = true;

    let acked = false;
    try {
      acked = localStorage.getItem(`cup-ack-${orderId}`) === "1";
    } catch {}

    if (acked || order.status === "done") {
      try {
        localStorage.removeItem("cup-active-order");
      } catch {}
      router.replace("/o/latest");
    }
  }, [order, orderId, router]);

  // ---------- live status ----------
  // The server pings this order's channel the moment the barista taps
  // "Ready", so the phone rings at once. Polling is only a safety net:
  // every 20 s while the socket is up, every 4 s if it isn't.
  const pollRef = useRef<() => void>(() => {});
  const onOrderPing = useCallback(() => pollRef.current(), []);
  const live = useLiveTopic(topic, onOrderPing);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/o/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json.order) return;

        const updated = json.order as Order;
        setOrder(updated);
        if (typeof json.topic === "string") setTopic(json.topic);

        try {
          const ack = localStorage.getItem(`cup-ack-${orderId}`);
          if (updated.status === "ready" && ack !== "1") setRinging(true);
        } catch {}
        if (updated.status === "done") setRinging(false);
      } catch {
        // network blip — next tick retries
      }
    }

    pollRef.current = () => void poll();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, live ? 20_000 : 4_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, live]);

  // ---------- unlock on the first interaction ----------
  useEffect(() => {
    if (audioUnlocked) return;
    const onFirst = () => {
      void unlockAudio();
    };
    document.addEventListener("pointerdown", onFirst, { once: true });
    document.addEventListener("keydown", onFirst, { once: true });
    return () => {
      document.removeEventListener("pointerdown", onFirst);
      document.removeEventListener("keydown", onFirst);
    };
  }, [audioUnlocked, unlockAudio]);

  // ---------- keep the context alive after backgrounding ----------
  useEffect(() => {
    const onVis = () => {
      const ctx = audioCtxRef.current;
      if (document.visibilityState === "visible" && ctx?.state === "suspended") {
        void ctx.resume();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ---------- sound + vibration ----------
  useEffect(() => {
    if (!ringing || acknowledged) {
      stopAudio();
      if (vibrateIntervalRef.current) {
        clearInterval(vibrateIntervalRef.current);
        vibrateIntervalRef.current = null;
      }
      if (navigator.vibrate) navigator.vibrate(0);
      return;
    }

    void startAudio();

    const buzz = () => {
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    };
    buzz();
    vibrateIntervalRef.current = setInterval(buzz, 2000);

    const originalTitle = document.title;
    let on = false;
    const titleInterval = setInterval(() => {
      document.title = on ? t("common.orderReadyTitle") : originalTitle;
      on = !on;
    }, 800);

    return () => {
      clearInterval(titleInterval);
      document.title = originalTitle;
      if (vibrateIntervalRef.current) {
        clearInterval(vibrateIntervalRef.current);
        vibrateIntervalRef.current = null;
      }
      if (navigator.vibrate) navigator.vibrate(0);
      stopAudio();
    };
  }, [ringing, acknowledged, audioUnlocked, startAudio, stopAudio, t]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  // ---------- wake lock ----------
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    async function acquire() {
      try {
        const wl = (
          navigator as unknown as {
            wakeLock?: {
              request: (t: "screen") => Promise<{
                release: () => Promise<void>;
              }>;
            };
          }
        ).wakeLock;
        if (wl) sentinel = await wl.request("screen");
      } catch {}
    }
    acquire();
    function onVis() {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, []);

  // Palettes and fonts come from fixed lists (same object each time), so
  // these are cheap plain values.
  const palette = getPalette(shop?.theme?.palette);
  const font = getFont(shop?.theme?.font);
  const themeVars: Record<string, string> = { ...(paletteVars(palette) as Record<string, string>) };
  if (shop?.theme?.primary) themeVars["--primary"] = shop.theme.primary;

  useEffect(() => {
    if (typeof document === "undefined" || !font) return;
    const id = `font-${font.id}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${font.google}&display=swap`;
    document.head.appendChild(link);
  }, [font]);

  const bodyFont = font.body.includes("serif")
    ? "ui-serif, Georgia, serif"
    : "ui-sans-serif, system-ui, sans-serif";

  const preparingMsg = shop?.messages?.preparing || t("cust.preparing");
  const readyMsg = shop?.messages?.ready || t("cust.ready");

  useEffect(() => {
    if (!order) return;
    if (acknowledged) {
      clearBadge();
      return;
    }
    if (order.status === "ready") {
      setBadge(1);
    } else if (order.status === "preparing") {
      setBadge();
    }
  }, [order, acknowledged]);

  useEffect(() => {
    if (!acknowledged) return;
    clearBadge();
    try {
      localStorage.removeItem("cup-active-order");
    } catch {}
  }, [acknowledged]);

  const elapsedLive = useElapsed(order?.created_at ?? null, null);
  const elapsedFinal = useElapsed(
    order?.created_at ?? null,
    order?.ready_at ?? null,
  );
  // useElapsed returns seconds. The server only allows a cancel after 20 min.
  const isStale = (elapsedLive ?? 0) > 30 * 60;

  async function handleCancelOrder() {
    setStaleError("");
    setStaleCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        setStaleError(t("common.error"));
        return;
      }
      try {
        localStorage.removeItem("cup-active-order");
      } catch {}
      router.replace("/o/latest");
    } catch {
      setStaleError(t("common.error"));
    } finally {
      setStaleCancelling(false);
    }
  }

  function handleAcknowledge() {
    setAcknowledged(true);
    setRinging(false);
    stopAudio();
    try {
      localStorage.setItem(`cup-ack-${orderId}`, "1");
      localStorage.removeItem("cup-active-order");
    } catch {}

    // Give them a moment with the review, then return to the scan screen so
    // the next order can start there.
    window.setTimeout(() => {
      router.replace("/o/latest");
    }, 7000);
  }

  if (loading) {
    return (
      <main
        className="relative min-h-screen flex flex-col"
        style={{
          background: "var(--bg, #faf7f2)",
          color: "var(--text, #1c1917)",
          ...themeVars,
          fontFamily: bodyFont,
        }}
      >
        <div className="relative z-10 flex min-h-screen flex-col">
          <header
            className="border-b px-5 py-4"
            style={{
              borderColor: "var(--border, #e7e5e4)",
              background: "var(--surface, #fff)",
            }}
          >
            <div className="max-w-md mx-auto flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--primary, #1c1917)",
                  color: "var(--primary-text, #fafaf9)",
                }}
              >
                <Coffee className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div className="text-sm font-semibold">{t("common.loading")}</div>
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="space-y-3 text-center">
              <Loader2
                className="w-6 h-6 animate-spin mx-auto"
                style={{ color: "var(--primary, #b45309)" }}
              />
              <p
                className="text-xs"
                style={{ color: "var(--text-muted, #78716c)" }}
              >
                {t("common.justAMoment")}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#faf7f2] text-stone-900">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-semibold">{t("common.orderNotFound")}</h1>
          <p className="text-sm text-stone-500">
            {error || t("common.askBarista")}
          </p>
        </div>
      </main>
    );
  }

  const ready = order.status === "ready";

  return (
    <main
      className="relative min-h-screen flex flex-col"
      style={{
        ...themeVars,
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: bodyFont,
      }}
    >
      {palette.pattern === "beans" && (
        <CozyPattern color={palette.primary} opacity={0.05} />
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <audio ref={audioRef} preload="none">
          <source src="/ready.mp3" type="audio/mpeg" />
        </audio>

        {/* HEADER */}
        <header
          className="border-b px-5 py-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Logo
                url={shop?.logo_url ?? null}
                name={shop?.name ?? t("common.shopFallback")}
                size={34}
                scale={Number(shop?.logo_scale ?? 1)}
                offsetX={Number(shop?.logo_offset_x ?? 0)}
                offsetY={Number(shop?.logo_offset_y ?? 0)}
                radius={9}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {shop?.name ?? t("common.shopFallback")}
                </div>
                {shop?.tagline && (
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {shop.tagline}
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <LanguageSwitcher compact />
            </div>
          </div>
        </header>

        <div className="flex-1">
          <div className="max-w-md mx-auto p-5 space-y-6">
            {/* ORDER NUMBER */}
            <div className="text-center space-y-2 pt-6">
              <div
                className="text-xs uppercase tracking-widest font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                {t("cust.yourOrder")}
              </div>
              <div className="text-6xl font-bold tabular-nums break-all">
                #{order.order_number}
              </div>
            </div>

            {/* ENABLE SOUND — shown whenever audio is still locked, including
                when the app opens directly on an already-ready order. */}
            {soundPrompt !== "hidden" && !acknowledged && (
              <div
                className="rounded-2xl border px-4 py-3.5 space-y-1 transition-colors duration-300"
                style={{
                  borderColor:
                    soundPrompt === "ok" ? "#a7f3d0" : "var(--border)",
                  background:
                    soundPrompt === "ok" ? "#ecfdf5" : "var(--surface)",
                }}
              >
                {soundPrompt === "ok" ? (
                  <div
                    className="flex items-center justify-center gap-2 text-sm font-semibold py-0.5"
                    style={{ color: "#047857" }}
                  >
                    <Check className="w-4 h-4 animate-bounce" strokeWidth={3} />
                    {t("cust.soundOn")}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleEnableSound}
                      disabled={soundPrompt === "loading"}
                      className="w-full text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition disabled:opacity-70"
                      style={{ color: "var(--text)" }}
                    >
                      {soundPrompt === "loading" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("cust.enableSound")}
                        </>
                      ) : (
                        <>
                          <BellRing className="w-4 h-4" />
                          {t("cust.enableSound")}
                        </>
                      )}
                    </button>
                    <p
                      className="text-[11px] text-center leading-snug"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t("cust.enableSoundHint")}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* STATUS */}
            {acknowledged ? (
              <div className="space-y-4">
                <div className="text-center space-y-3 py-4">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: "#d1fae5" }}
                  >
                    <Check
                      className="w-10 h-10"
                      style={{ color: "#059669" }}
                      strokeWidth={2.5}
                    />
                  </div>
                  <p className="text-lg font-semibold">{t("cust.enjoy")}</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t("cust.canClose")}
                  </p>
                </div>

                <ReviewPrompt orderId={orderId} />
              </div>
            ) : ready ? (
              <div className="space-y-5 py-4">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mx-auto animate-pulse"
                  style={{ background: "#d1fae5" }}
                >
                  <BellRing
                    className="w-12 h-12"
                    style={{ color: "#059669" }}
                  />
                </div>
                <div className="text-center space-y-1">
                  <h1
                    className="text-3xl font-bold"
                    style={{ color: "#047857" }}
                  >
                    {readyMsg}
                  </h1>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t("cust.pickup")}
                  </p>
                  <p
                    className="text-xs inline-flex items-center gap-1.5 tabular-nums pt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {t("cust.readyIn")}{" "}
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {formatElapsed(elapsedFinal)}
                    </span>
                  </p>
                </div>

                <button
                  onClick={handleAcknowledge}
                  className="w-full py-4 rounded-2xl font-bold text-lg active:scale-[0.99] transition"
                  style={{
                    background: "#059669",
                    color: "#ffffff",
                  }}
                >
                  {t("cust.gotIt")}
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-center py-4">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "var(--accent-soft)" }}
                >
                  <Coffee
                    className="w-10 h-10"
                    style={{ color: "var(--accent)" }}
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold">{preparingMsg}</h1>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {t("cust.willRing")}
                  </p>
                </div>

                {/* Progress */}
                <div className="pt-3 max-w-xs mx-auto">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span>{t("cust.received")}</span>
                    <span>{t("cust.preparingStep")}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {t("cust.readyStep")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: "var(--border)" }}
                    />
                  </div>
                </div>

                {/* Live elapsed timer */}
                <div
                  className="pt-4 flex items-center justify-center gap-1.5 text-xs tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t("cust.waitingFor")}</span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {formatElapsed(elapsedLive)}
                  </span>
                </div>

                {/* Stale order: waiting too long */}
                {isStale && !staleDismissed && (
                  <div
                    className="rounded-2xl border px-4 py-4 space-y-3 text-left"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {t("cust.staleTitle")}
                      </p>
                      <p
                        className="text-xs leading-snug"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("cust.staleBody")}
                      </p>
                    </div>

                    {staleError && (
                      <p className="text-xs text-red-600">{staleError}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelOrder}
                        disabled={staleCancelling}
                        className="flex-1 py-2.5 rounded-xl bg-stone-900 text-amber-50 text-sm font-semibold disabled:opacity-50 transition"
                      >
                        {t("cust.staleCancel")}
                      </button>
                      <button
                        onClick={() => setStaleDismissed(true)}
                        className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        {t("cust.staleWait")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notifications prompt */}
            {!acknowledged && <NotificationSetup orderId={orderId} />}

            {/* GAME */}
            {!acknowledged && shop?.game !== "none" && (
              <div className="space-y-2">
                <div
                  className="text-xs uppercase tracking-wider font-semibold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("cust.whileYouWait")}
                </div>
                <CatchBeans />
              </div>
            )}
          </div>
        </div>

        <footer
          className="px-5 py-5 text-center text-[11px] flex flex-col items-center gap-2"
          style={{ color: "var(--text-muted)" }}
        >
          <span>{t("cust.keepOpen")}</span>
          <span className="inline-flex items-center gap-1.5 opacity-70">
            <BrandLogo size={12} />
            <span>{t("cust.poweredBy")}</span>
          </span>
        </footer>
      </div>
    </main>
  );
}