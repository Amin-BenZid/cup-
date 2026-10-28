import { supabaseAdmin } from "@/lib/supabase-admin";
import { getArchive } from "@/lib/shop-archive";

/**
 * The one place that decides what a café's staff can do right now.
 *
 *   ok        dashboard works
 *   pending   waiting for approval
 *   expired   trial or subscription ended (reason says which)
 *   disabled  paused by the Beep team
 *   archived  closed by the Beep team (data kept)
 *   deleted   the café no longer exists
 */
export type AccessState = "ok" | "pending" | "expired" | "disabled" | "archived" | "deleted";

export type ShopAccess = {
  state: AccessState;
  reason?: "trial" | "subscription";
  shop?: { id: string; name: string; status: string };
  trial_ok?: boolean;
  subscription_ok?: boolean;
};

export async function getShopAccess(shopId: string): Promise<ShopAccess> {
  const { data: shop, error } = await supabaseAdmin
    .from("shops")
    .select("id, name, status, trial_ends_at, subscription_ends_at, billing_status")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw error;
  if (!shop) return { state: "deleted" };

  const base = { shop: { id: shop.id, name: shop.name, status: shop.status } };
  if (await getArchive(shop.id)) return { state: "archived", ...base };
  if (shop.status === "pending") return { state: "pending", ...base };
  if (shop.status !== "active") return { state: "disabled", ...base };

  const now = Date.now();
  const trialOk = !!shop.trial_ends_at && new Date(shop.trial_ends_at).getTime() > now;
  const subOk = !!shop.subscription_ends_at && new Date(shop.subscription_ends_at).getTime() > now;
  if (!trialOk && !subOk) {
    // Ever paid → their subscription ended; otherwise the free trial did.
    const reason = shop.subscription_ends_at || shop.billing_status === "active" ? "subscription" : "trial";
    return { state: "expired", reason, trial_ok: false, subscription_ok: false, ...base };
  }
  return { state: "ok", trial_ok: trialOk, subscription_ok: subOk, ...base };
}
