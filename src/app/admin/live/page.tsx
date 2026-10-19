"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Activity,
  CheckCircle2,
  Clock,
  Package,
  Store,
  Search,
  X,
} from "lucide-react";
import CupLogo from "@/components/CupLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/context";

type LiveOrder = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  ready_at: string | null;
  shop_id: string;
  shops: {
    name: string;
    logo_url: string | null;
  } | null;
};

export default function LiveFeedPage() {
  const t = useT();
  const router = useRouter();
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering state
  const [search, setSearch] = useState("");
  const [selectedShop, setSelectedShop] = useState<string | "all">("all");
  const [shopMenuOpen, setShopMenuOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setOrders(json.orders);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadOrders();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadOrders();
    }, 4000);

    const onVisible = () => {
      if (document.visibilityState === "visible") loadOrders();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadOrders]);

  // Extract unique shops for the filter menu
  const uniqueShops = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (o.shop_id && o.shops?.name) {
        map.set(o.shop_id, o.shops.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  // Apply filters
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedShop !== "all" && o.shop_id !== selectedShop) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const shopName = o.shops?.name?.toLowerCase() ?? "";
        const orderNum = o.order_number.toLowerCase();
        if (!shopName.includes(q) && !orderNum.includes(q)) return false;
      }
      return true;
    });
  }, [orders, selectedShop, search]);

  function timeSince(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
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
            {t("common.back")}
          </button>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-sm font-semibold">{t("live.title")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <CupLogo size={20} />
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      <div className="sticky top-[53px] z-10 bg-zinc-50 border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("live.searchPlaceholder")}
              className="w-full ps-9 pe-8 py-2 bg-white border border-zinc-200 rounded-md text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Shop Filter Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShopMenuOpen((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition ${
                selectedShop !== "all"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <Store className="w-4 h-4" />
              <span className="max-w-[100px] truncate">
                {selectedShop === "all"
                  ? t("live.allShops")
                  : uniqueShops.find((s) => s.id === selectedShop)?.name ||
                    "Shop"}
              </span>
            </button>

            {shopMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShopMenuOpen(false)}
                />
                <div className="absolute end-0 top-full mt-2 w-56 bg-white border border-zinc-200 rounded-md shadow-lg overflow-hidden z-40 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedShop("all");
                      setShopMenuOpen(false);
                    }}
                    className={`w-full text-start px-4 py-2.5 text-sm hover:bg-zinc-50 transition ${
                      selectedShop === "all"
                        ? "font-semibold text-zinc-900 bg-zinc-50"
                        : "text-zinc-600"
                    }`}
                  >
                    {t("live.allShops")}
                  </button>
                  {uniqueShops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => {
                        setSelectedShop(shop.id);
                        setShopMenuOpen(false);
                      }}
                      className={`w-full text-start px-4 py-2.5 text-sm hover:bg-zinc-50 transition truncate ${
                        selectedShop === shop.id
                          ? "font-semibold text-zinc-900 bg-zinc-50"
                          : "text-zinc-600"
                      }`}
                    >
                      {shop.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-24 bg-white border border-dashed border-zinc-300 rounded-lg">
            <Activity className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-900">
              {orders.length === 0 ? t("live.noOrders") : t("live.noResults")}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {orders.length === 0
                ? t("live.waiting")
                : t("live.adjustFilters")}
            </p>
            {(search || selectedShop !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedShop("all");
                }}
                className="mt-4 text-sm text-zinc-500 hover:text-zinc-900 underline"
              >
                {t("live.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-100">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`flex items-center justify-between gap-4 px-4 py-3 transition ${
                  order.status === "ready" ? "bg-emerald-50/30" : ""
                } ${order.status === "done" ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {order.shops?.logo_url ? (
                    <img
                      src={order.shops.logo_url}
                      alt=""
                      className="w-8 h-8 rounded-md object-cover border border-zinc-200 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center text-zinc-100 font-semibold text-[10px] shrink-0">
                      {order.shops?.name?.[0] || "S"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/admin/shops/${order.shop_id}`}
                      className="text-sm font-medium text-zinc-900 truncate hover:underline block"
                    >
                      {order.shops?.name || "Unknown Shop"}
                    </Link>
                    <div className="text-[11px] text-zinc-500 tabular-nums">
                      #{order.order_number} · {timeSince(order.created_at)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const base =
    "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded";
  if (status === "ready")
    return (
      <span className={`${base} bg-emerald-100 text-emerald-700`}>Ready</span>
    );
  if (status === "done")
    return (
      <span className={`${base} bg-zinc-100 text-zinc-600`}>Picked up</span>
    );
  return (
    <span className={`${base} bg-amber-100 text-amber-800`}>Preparing</span>
  );
}
