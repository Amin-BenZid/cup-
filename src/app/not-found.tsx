"use client";

import { QrCode } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useT } from "@/lib/i18n/context";

export default function NotFound() {
  const t = useT();

  return (
    <main className="min-h-screen bg-[#faf7f2] text-stone-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto">
            <QrCode className="w-7 h-7 text-stone-500" />
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{t("notFound.title")}</h1>
            <p className="text-sm text-stone-500">{t("notFound.body")}</p>
          </div>
        </div>
      </div>

      <footer className="px-6 pb-8 pt-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2 text-[11px] text-stone-400">
          <BrandLogo size={14} />
          <span>beep</span>
        </div>
      </footer>
    </main>
  );
}