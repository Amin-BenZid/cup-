"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Loader2, ArrowRight } from "lucide-react";
import CupLogo from "@/components/CupLogo";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Login failed");
        return;
      }
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-stone-100">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 p-7 space-y-5 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <CupLogo size={48} />
          </div>
          <h1 className="text-lg font-semibold text-stone-900">Cup Admin</h1>
          <p className="text-xs text-stone-500">Sign in to manage cafés</p>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 outline-none text-sm"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          className="w-full py-3 rounded-xl bg-stone-900 text-amber-50 font-semibold text-sm hover:bg-stone-800 disabled:opacity-40 transition inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </main>
  );
}
