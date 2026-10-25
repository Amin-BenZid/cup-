"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Store,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  MessageCircle,
  Check,
  ChevronRight,
} from "lucide-react";
import CupLogo from "@/components/CupLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/context";
import { MONTHLY_PRICE_TND } from "@/lib/config";

type Shop = {
  id: string;
  name: string;
  tagline?: string | null;
  status: string;
  created_at: string;
  logo_url?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  billing_status?: string | null;
  phone?: string | null;
  paid_current_month?: boolean;
};

type BillingFilter = "all" | "trial" | "active" | "expired" | "unpaid";

export default function AdminBillingPage() {
  const t = useT();
  const router = useRouter();

  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BillingFilter>("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/shops", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const json = await res.json();
        if (res.ok) setShops(json.shops);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    return shops.filter((s) => {
      const now = new Date();
      const trialEnds = s.trial_ends_at ? new Date(s.trial_ends_at) : null;
      const subEnds = s.subscription_ends_at
        ? new Date(s.subscription_ends_at)
        : null;
      const isTrialExpired = trialEnds && now > trialEnds;
      const isSubExpired = subEnds ? now > subEnds : true;
      const status = s.billing_status || "trial";

      // 1. Filter by Status
      if (filter !== "all") {
        if (filter === "expired" && !(isTrialExpired && isSubExpired))
          return false;
        if (filter === "trial" && status !== "trial") return false;
        if (filter === "active" && !(status === "active" && !isSubExpired))
          return false;
        if (filter === "unpaid" && s.paid_current_month) return false;
      }

      // 2. Filter by Search
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [shops, filter, query]);

  const { counts, mrr } = useMemo(() => {
    let trial = 0,
      active = 0,
      expired = 0,
      unpaid = 0;
    let calculatedMrr = 0;
    const now = new Date();

    shops.forEach((s) => {
      const trialEnds = s.trial_ends_at ? new Date(s.trial_ends_at) : null;
      const subEnds = s.subscription_ends_at
        ? new Date(s.subscription_ends_at)
        : null;
      const isTrialExpired = trialEnds && now > trialEnds;
      const isSubExpired = subEnds ? now > subEnds : true;
      const status = s.billing_status || "trial";

      if (!s.paid_current_month) unpaid++;

      if (isTrialExpired && isSubExpired) expired++;
      else if (status === "active" && !isSubExpired) {
        active++;
        calculatedMrr += MONTHLY_PRICE_TND;
      } else trial++;
    });

    return {
      counts: { all: shops.length, trial, active, expired, unpaid },
      mrr: calculatedMrr,
    };
  }, [shops]);

  function getBillingLabel(shop: Shop) {
    const now = new Date();
    const trialEnds = shop.trial_ends_at ? new Date(shop.trial_ends_at) : null;
    const subEnds = shop.subscription_ends_at
      ? new Date(shop.subscription_ends_at)
      : null;
    const isTrialExpired = trialEnds && now > trialEnds;
    const isSubExpired = subEnds ? now > subEnds : true;
    const status = shop.billing_status || "trial";

    if (isTrialExpired && isSubExpired) {
      return {
        label: "Expired",
        color: "text-red-600",
        bg: "bg-red-50",
        icon: XCircle,
      };
    }
    if (status === "active" && !isSubExpired) {
      return {
        label: "Active",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        icon: CheckCircle2,
      };
    }
    return {
      label: "Trial",
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: Clock,
    };
  }

  // Calculate the time remaining
  function getTimeRemaining(dateString?: string | null) {
    if (!dateString) return { text: "—", color: "text-zinc-400" };

    const now = new Date();
    const end = new Date(dateString);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Expired ${Math.abs(diffDays)}d ago`,
        color: "text-red-600 font-medium",
      };
    }
    if (diffDays === 0) {
      return { text: "Ends today", color: "text-amber-600 font-medium" };
    }
    if (diffDays <= 7) {
      return {
        text: `Ends in ${diffDays} days`,
        color: "text-amber-600 font-medium",
      };
    }
    if (diffDays <= 30) {
      return { text: `Ends in ${diffDays} days`, color: "text-zinc-600" };
    }

    const diffMonths = Math.floor(diffDays / 30);
    return {
      text: `Ends in ${diffMonths} month${diffMonths > 1 ? "s" : ""}`,
      color: "text-zinc-500",
    };
  }

  function getWhatsAppLink(shop: Shop) {
    if (!shop.phone) return null;
    const phone = shop.phone.replace(/\D/g, "");

    // Use the translated message with the shop name injected
    const messageText = t("billing.whatsappMsg").replace("%name", shop.name);
    const message = encodeURIComponent(messageText);

    return `https://wa.me/${phone}?text=${message}`;
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition -ms-2 p-2 rounded-md hover:bg-zinc-100"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold">Billing</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <CupLogo size={20} />
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        {/* MRR CARD */}
        <section className="bg-white border border-zinc-200 rounded-lg p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
              Est. Monthly Revenue
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {mrr} <span className="text-lg text-zinc-400">TND</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
              Unpaid
            </div>
            <div className="text-2xl font-semibold tabular-nums text-amber-600">
              {counts.unpaid}
            </div>
          </div>
        </section>

        {/* SEARCH & FILTERS */}
        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by shop name..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-md text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              ["all", "trial", "active", "expired", "unpaid"] as BillingFilter[]
            ).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-md text-xs font-medium capitalize transition border ${
                  filter === f
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {f}
                <span
                  className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                    filter === f
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* LIST */}
        <section>
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-zinc-300 rounded-lg">
              <Store className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">
                No shops match your filter.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100">
              {filtered.map((shop) => {
                const badge = getBillingLabel(shop);
                const Icon = badge.icon;
                const waLink = getWhatsAppLink(shop);

                const trialTime = getTimeRemaining(shop.trial_ends_at);
                const subTime = getTimeRemaining(shop.subscription_ends_at);

                return (
                  <Link
                    key={shop.id}
                    href={`/admin/shops/${shop.id}`}
                    className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {shop.logo_url ? (
                        <img
                          src={shop.logo_url}
                          alt=""
                          className="w-9 h-9 rounded-md object-cover border border-zinc-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-100 font-semibold text-xs shrink-0">
                          {shop.name[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {shop.name}
                          </span>
                          {waLink && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(waLink, "_blank");
                              }}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition shrink-0 z-10"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {shop.paid_current_month && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <Check className="w-2.5 h-2.5" /> Paid
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Icon className={`w-3 h-3 ${badge.color}`} />
                            <span className={badge.color}>{badge.label}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            Trial:{" "}
                            {shop.trial_ends_at
                              ? new Date(
                                  shop.trial_ends_at,
                                ).toLocaleDateString()
                              : "—"}
                            <span className={`ml-1 ${trialTime.color}`}>
                              ({trialTime.text})
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            Sub:{" "}
                            {shop.subscription_ends_at
                              ? new Date(
                                  shop.subscription_ends_at,
                                ).toLocaleDateString()
                              : "—"}
                            <span className={`ml-1 ${subTime.color}`}>
                              ({subTime.text})
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition rtl:rotate-180 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
