"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import CupLogo from "@/components/CupLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/context";
import { formatTemplate } from "@/lib/i18n/translations";

type Status = "pending" | "active" | "disabled" | "unknown";

export default function PendingPage() {
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("pending");
  const [shopName, setShopName] = useState("");
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("shop_id");
    const name = localStorage.getItem("shop_name");
    if (!id) {
      router.replace("/setup");
      return;
    }
    setShopId(id);
    setShopName(name ?? "");
  }, [router]);

  useEffect(() => {
    if (!shopId) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/api/shops/${shopId}/status`, {
          cache: "no-store",
        });

        if (res.status === 404) {
          if (!cancelled) setStatus("disabled");
          return;
        }

        if (!res.ok) {
          return;
        }

        const json = await res.json();
        if (cancelled) return;

        const s = json?.status as Status | undefined;
        if (s === "active") {
          setStatus("active");
          // No session exists yet, so the PIN login has to issue one. Drop the
          // cached id first, or /barista would bounce straight to the dashboard.
          localStorage.removeItem("shop_id");
          setTimeout(() => router.push("/barista"), 1200);
        } else if (s === "disabled") {
          setStatus("disabled");
        } else if (s === "pending") {
          setStatus("pending");
        }
      } catch {
        // network glitch — keep polling
      }
    }

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shopId, router]);

  function retry() {
    setStatus("pending");
    if (shopId) {
      fetch(`/api/shops/${shopId}/status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          const s = j?.status;
          if (s === "active") setStatus("active");
          else if (s === "disabled") setStatus("disabled");
          else setStatus("pending");
        })
        .catch(() => setStatus("pending"));
    }
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      <header className="px-6 pt-8 pb-2">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition -ms-1.5"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t("setup.back")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 px-6 pb-10 flex items-center">
        <div className="max-w-md mx-auto w-full space-y-10 text-center">
          {status === "pending" && (
            <>
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center relative">
                  <Clock className="w-9 h-9 text-amber-700" strokeWidth={2} />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-stone-200 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {t("pending.title")}
                </h1>
                <p className="text-stone-500 text-[15px] leading-relaxed max-w-sm mx-auto">
                  {formatTemplate(t("pending.body"), {
                    name: shopName || "Café",
                  })}
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3 text-start">
                <div className="text-xs uppercase tracking-wider font-semibold text-stone-500">
                  {t("pending.whatHappens")}
                </div>
                <ul className="space-y-2.5 text-sm text-stone-700">
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-amber-50 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>{t("pending.step1")}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-amber-50 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>{t("pending.step2")}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-stone-900 text-amber-50 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>{t("pending.step3")}</span>
                  </li>
                </ul>
              </div>

              <p className="text-xs text-stone-400">
                {t("pending.autoRefresh")}
              </p>
            </>
          )}

          {status === "active" && (
            <>
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-pulse">
                  <CheckCircle2
                    className="w-10 h-10 text-emerald-700"
                    strokeWidth={2.2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {t("pending.approved")}
                </h1>
                <p className="text-stone-500 text-[15px]">
                  {t("pending.redirecting")}
                </p>
              </div>
            </>
          )}

          {status === "disabled" && (
            <>
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle
                    className="w-10 h-10 text-red-700"
                    strokeWidth={2.2}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {t("pending.declined")}
                </h1>
                <p className="text-stone-500 text-[15px] leading-relaxed max-w-sm mx-auto">
                  {t("pending.declinedBody")}
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-stone-300 text-sm font-medium hover:bg-white transition"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                {t("pending.backHome")}
              </Link>
            </>
          )}

          {status === "unknown" && (
            <>
              <div className="flex justify-center">
                <CupLogo size={44} />
              </div>
              <p className="text-stone-500 text-sm">{t("pending.unknown")}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={retry}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-stone-900 text-amber-50 text-sm font-medium hover:bg-stone-800 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <Link href="/" className="text-sm underline text-stone-700">
                  {t("pending.backHome")}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <CupLogo size={14} />
          <span>Cup</span>
        </div>
      </footer>
    </main>
  );
}
