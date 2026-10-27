"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Bell, ArrowRight, Store, User, Gift } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/context";

export default function Home() {
  const t = useT();
  const router = useRouter();

  // A logged-in barista who opens the site should land on the dashboard,
  // not on the marketing page.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.shop?.id) {
          router.replace("/barista/dashboard");
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      {/* Top bar */}
      <header className="px-6 pt-8 pb-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={36} />
            <div className="text-[17px] font-bold tracking-[-0.045em]">beep</div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 px-6 pb-10">
        <div className="max-w-md mx-auto pt-8 space-y-12">
          {/* Intro */}
          <div className="space-y-4">
            <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-tight">
              {t("landing.tagline")}
            </h1>
            <p className="text-stone-500 text-[15px] leading-relaxed max-w-sm">
              {t("landing.subtitle")}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/setup"
              className="group flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800 active:scale-[0.99] transition shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" strokeWidth={2} />
                </div>

                <div className="text-left rtl:text-right">
                  <div className="text-sm font-semibold">
                    {t("landing.setup")}
                  </div>

                  <div className="text-[11px] text-amber-100/70 flex items-center gap-1.5 mt-0.5">
                    <Gift className="w-3 h-3 shrink-0" />
                    {t("landing.freeTrial")}
                  </div>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition rtl:rotate-180 shrink-0" />
            </Link>

            <Link
              href="/barista"
              className="group flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 active:scale-[0.99] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-stone-700" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">
                    {t("landing.barista")}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {t("landing.baristaHint")}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 transition rtl:rotate-180 shrink-0" />
            </Link>
          </div>

          {/* How it works */}
          <div className="pt-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-5">
              {t("landing.howItWorks")}
            </div>
            <div className="space-y-5">
              <Step
                number="1"
                icon={<Store className="w-4 h-4" strokeWidth={2.2} />}
                title={t("landing.step1")}
                description={t("landing.step1Hint")}
              />
              <Step
                number="2"
                icon={<QrCode className="w-4 h-4" strokeWidth={2.2} />}
                title={t("landing.step2")}
                description={t("landing.step2Hint")}
              />
              <Step
                number="3"
                icon={<Bell className="w-4 h-4" strokeWidth={2.2} />}
                title={t("landing.step3")}
                description={t("landing.step3Hint")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <BrandLogo size={14} />
          <span>{t("landing.footer")}</span>
        </div>
      </footer>
    </main>
  );
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 flex flex-col items-center">
        <div className="w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700">
          {icon}
        </div>
      </div>
      <div className="min-w-0 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-stone-400">{number}</span>
          <div className="text-sm font-medium text-stone-900">{title}</div>
        </div>
        <div className="text-xs text-stone-500 mt-0.5">{description}</div>
      </div>
    </div>
  );
}