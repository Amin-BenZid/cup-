"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import CupLogo from "@/components/CupLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/context";

export default function BaristaLogin() {
  const t = useT();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const shopId = localStorage.getItem("shop_id");
    if (shopId) {
      router.replace("/barista/dashboard");
    } else {
      setChecking(false);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (pin.length < 4) {
      setError(t("login.error.pinTooShort"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();

      if (!res.ok) {
        // Pending → send to /pending screen
        if (json.status === "pending") {
          localStorage.setItem("shop_id", json.shop_id ?? "");
          router.push("/pending");
          return;
        }
        // Disabled → show clear error
        if (json.status === "disabled") {
          setError(t("login.error.disabled"));
          setPin("");
          return;
        }
        setError(json.error ?? "Login failed");
        setPin("");
        return;
      }

      localStorage.setItem("shop_id", json.shop.id);
      localStorage.setItem("shop_name", json.shop.name);
      router.push("/barista/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-[#faf7f2] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </main>
    );
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

      <div className="flex-1 px-6 pb-10">
        <div className="max-w-md mx-auto pt-6 space-y-10">
          <div className="space-y-3">
            <CupLogo size={44} />
            <h1 className="text-3xl font-semibold tracking-tight pt-2">
              {t("login.title")}
            </h1>
            <p className="text-stone-500 text-[15px] leading-relaxed">
              {t("login.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2.5">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="••••"
                maxLength={6}
                className="w-full px-4 py-5 rounded-2xl bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-center text-3xl tracking-[0.5em] font-mono tabular-nums transition"
              />
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full py-4 rounded-2xl bg-stone-900 text-amber-50 font-semibold hover:bg-stone-800 disabled:opacity-40 active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("login.button")
              )}
            </button>

            <p className="text-xs text-stone-400 text-center">
              {t("login.newShop")}{" "}
              <Link
                href="/setup"
                className="text-stone-700 underline underline-offset-2"
              >
                {t("login.setupLink")}
              </Link>
            </p>
          </form>
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <CupLogo size={14} />
          <span>{t("login.footer")}</span>
        </div>
      </footer>
    </main>
  );
}
