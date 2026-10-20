"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useT } from "@/lib/i18n/context";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message ?? "Unknown error",
        stack: error?.stack ?? "",
        url: typeof window !== "undefined" ? window.location.href : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />

        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{t("error.title")}</h1>
          <p className="text-sm text-stone-500">{t("error.body")}</p>
        </div>

        <button
          onClick={reset}
          className="px-5 py-3 rounded-2xl bg-stone-900 text-amber-50 text-sm font-semibold hover:bg-stone-800 active:scale-[0.99] transition"
        >
          {t("error.retry")}
        </button>
      </div>
    </main>
  );
}