import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Typed helpers around the `global_settings` key/value table.
 * Server only (service-role client).
 */

export async function getSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin
    .from("global_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  let value = data?.value ?? null;
  // Some older rows were stored as JSON strings.
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      /* keep as string */
    }
  }
  return value as T | null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabaseAdmin
    .from("global_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

export async function deleteSetting(key: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("global_settings")
    .delete()
    .eq("key", key);
  if (error) throw error;
}

/** All rows whose key starts with `prefix` (prefix must not contain % or _ meant literally). */
export async function listSettings<T>(
  prefix: string,
): Promise<{ key: string; value: T }[]> {
  const { data, error } = await supabaseAdmin
    .from("global_settings")
    .select("key, value")
    .like("key", `${prefix}%`);
  if (error) throw error;
  return ((data ?? []) as { key: string; value: T }[]).filter((r) =>
    r.key.startsWith(prefix),
  );
}
