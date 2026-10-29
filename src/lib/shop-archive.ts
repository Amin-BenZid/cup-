import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteSetting, getSetting, listSettings, setSetting } from "@/lib/settings";
import { fetchAllRows } from "@/lib/admin-stats";

/**
 * Archiving and permanent deletion of a shop.
 *
 * Archive = status "disabled" (baristas are blocked at once by requireShop and
 * the login route) + a record in global_settings `shop_archive:<id>` holding
 * when it happened and the status to restore. No schema change needed.
 *
 * Delete = only for archived shops. Removes every row and file that belongs
 * to the shop explicitly (children first, the shop row last), so it does not
 * depend on database cascades and can simply be retried if it stops halfway.
 */

const PREFIX = "shop_archive:";

export type ArchiveRecord = { archived_at: string; previous_status: string };

export async function getArchive(shopId: string) {
  return getSetting<ArchiveRecord>(PREFIX + shopId);
}

/** Map of shopId → archive record, for lists. */
export async function listArchives(): Promise<Map<string, ArchiveRecord>> {
  const rows = await listSettings<ArchiveRecord>(PREFIX);
  return new Map(rows.map((r) => [r.key.slice(PREFIX.length), r.value]));
}

export async function archiveShop(shopId: string, currentStatus: string) {
  const record: ArchiveRecord = {
    archived_at: new Date().toISOString(),
    // Restoring a pending shop puts it back to pending, not straight to active.
    previous_status: currentStatus === "disabled" ? "disabled" : currentStatus,
  };
  // Block access first, then mark it archived.
  const { error } = await supabaseAdmin.from("shops").update({ status: "disabled" }).eq("id", shopId);
  if (error) throw error;
  await setSetting(PREFIX + shopId, record);
  return record;
}

export async function restoreShop(shopId: string) {
  const record = await getArchive(shopId);
  if (!record) return null;
  const status = ["pending", "active", "disabled"].includes(record.previous_status)
    ? record.previous_status
    : "disabled";
  const { error } = await supabaseAdmin.from("shops").update({ status }).eq("id", shopId);
  if (error) throw error;
  await deleteSetting(PREFIX + shopId);
  return status;
}

export type DeleteReport = {
  orders: number;
  push_subscriptions: number;
  reviews: number;
  support_messages: number;
  shop_history: number;
  logo_files: number;
  settings: number;
};

async function del(table: string, column: string, value: string) {
  const { error, count } = await supabaseAdmin
    .from(table)
    .delete({ count: "exact" })
    .eq(column, value);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

/** Permanently delete a shop and everything that belongs to it. */
export async function deleteShopCompletely(shopId: string): Promise<DeleteReport> {
  const report: DeleteReport = {
    orders: 0,
    push_subscriptions: 0,
    reviews: 0,
    support_messages: 0,
    shop_history: 0,
    logo_files: 0,
    settings: 0,
  };

  // 1. Push subscriptions hang off orders (no shop_id column), so collect
  //    the shop's order ids first and delete their subscriptions in batches.
  const { rows: orders } = await fetchAllRows<{ id: string }>(
    (a, b) =>
      supabaseAdmin
        .from("orders")
        .select("id")
        .eq("shop_id", shopId)
        .order("id", { ascending: true })
        .range(a, b),
    1_000_000,
  );
  const ids = orders.map((o) => o.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error, count } = await supabaseAdmin
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .in("order_id", chunk);
    if (error) throw new Error(`push_subscriptions: ${error.message}`);
    report.push_subscriptions += count ?? 0;
  }

  // 2. Rows that reference orders or the shop.
  report.reviews = await del("reviews", "shop_id", shopId);
  report.orders = await del("orders", "shop_id", shopId);
  report.support_messages = await del("support_messages", "shop_id", shopId);
  report.shop_history = await del("shop_history", "shop_id", shopId);

  // 3. Logo files in storage: logos/<shopId>/...
  const bucket = supabaseAdmin.storage.from("logos");
  for (let round = 0; round < 50; round++) {
    const { data: files, error } = await bucket.list(shopId, { limit: 100 });
    if (error) throw new Error(`logos: ${error.message}`);
    const paths = (files ?? []).filter((f) => f.name).map((f) => `${shopId}/${f.name}`);
    if (paths.length === 0) break;
    const { error: rmErr } = await bucket.remove(paths);
    if (rmErr) throw new Error(`logos: ${rmErr.message}`);
    report.logo_files += paths.length;
    if (paths.length < 100) break;
  }

  // 4. Settings that belong to the shop (archive record last, below).
  // Staff phones registered for notifications (see lib/shop-notify.ts).
  const deviceKeys = (await listSettings(`shop_push:${shopId}:`)).map((r) => r.key)
  for (const key of [`admin_notify_throttle:support:${shopId}`, `pin_reset_request:${shopId}`, ...deviceKeys]) {
    await deleteSetting(key).catch(() => {});
    report.settings++;
  }

  // 5. The shop itself, then its archive record.
  const { error: shopErr } = await supabaseAdmin.from("shops").delete().eq("id", shopId);
  if (shopErr) throw new Error(`shops: ${shopErr.message}`);
  const { data: still, error: checkErr } = await supabaseAdmin
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .maybeSingle();
  if (checkErr) throw new Error(`shops: ${checkErr.message}`);
  if (still) throw new Error("shops: row still there");
  await deleteSetting(PREFIX + shopId);
  report.settings++;

  return report;
}
