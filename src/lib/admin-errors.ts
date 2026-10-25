import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * client_errors helpers. The table's schema isn't in the repo, so we don't
 * assume a created_at column exists: if ordering/filtering by it fails we
 * fall back gracefully.
 */

export type ClientError = {
  id?: string | number;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  created_at?: string | null;
};

export async function listErrors(limit = 100): Promise<ClientError[]> {
  const ordered = await supabaseAdmin
    .from("client_errors")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!ordered.error) return (ordered.data ?? []) as ClientError[];

  const plain = await supabaseAdmin.from("client_errors").select("*").limit(limit);
  if (plain.error) throw plain.error;
  return ((plain.data ?? []) as ClientError[]).reverse();
}

export async function countRecentErrors(hours: number): Promise<number> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const res = await supabaseAdmin
    .from("client_errors")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  return res.error ? 0 : (res.count ?? 0);
}

export async function clearErrors(): Promise<void> {
  // PostgREST requires a filter on delete; match every row.
  const byDate = await supabaseAdmin
    .from("client_errors")
    .delete()
    .gte("created_at", "1970-01-01");
  if (!byDate.error) return;
  const byMessage = await supabaseAdmin
    .from("client_errors")
    .delete()
    .not("message", "is", null);
  if (byMessage.error) throw byMessage.error;
}
