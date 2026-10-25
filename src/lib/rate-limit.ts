import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Fixed-window rate limit persisted in `global_settings`, so it is shared by
 * every serverless instance and survives cold starts.
 *
 * Rows look like: key = "rl:<scope>:<sha256(id)>", value = { count, reset_at }.
 * Not atomic (read-then-write), so a burst of parallel requests can slip a few
 * extra attempts through. That's fine for a login throttle.
 *
 * If the database is unreachable we fall back to a per-instance Map rather
 * than failing open or locking everyone out.
 */

type Window = { count: number; reset_at: number };

const memory = new Map<string, Window>();

function rowKey(scope: string, id: string) {
  const h = crypto.createHash("sha256").update(id).digest("hex").slice(0, 32);
  return `rl:${scope}:${h}`;
}

async function read(key: string): Promise<Window | null> {
  const { data, error } = await supabaseAdmin
    .from("global_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  const v = data?.value as Partial<Window> | undefined;
  if (!v || typeof v.count !== "number" || typeof v.reset_at !== "number") {
    return null;
  }
  return { count: v.count, reset_at: v.reset_at };
}

async function write(key: string, value: Window) {
  const { error } = await supabaseAdmin
    .from("global_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

async function prune(scope: string, now: number) {
  // reset_at is a 13-digit ms timestamp, so text comparison is numeric-safe.
  await supabaseAdmin
    .from("global_settings")
    .delete()
    .like("key", `rl:${scope}:%`)
    .lt("value->>reset_at", String(now));
}

export type RateLimiter = {
  /** true if the caller is currently blocked */
  isBlocked(id: string): Promise<boolean>;
  /** record one failed attempt */
  fail(id: string): Promise<void>;
  /** clear the window after a success */
  reset(id: string): Promise<void>;
};

export function createRateLimiter(
  scope: string,
  max: number,
  windowMs: number,
): RateLimiter {
  return {
    async isBlocked(id) {
      const key = rowKey(scope, id);
      const now = Date.now();
      let w: Window | null;
      try {
        w = await read(key);
      } catch {
        w = memory.get(key) ?? null;
      }
      return !!w && w.reset_at > now && w.count >= max;
    },

    async fail(id) {
      const key = rowKey(scope, id);
      const now = Date.now();
      try {
        const w = await read(key);
        const next: Window =
          w && w.reset_at > now
            ? { count: w.count + 1, reset_at: w.reset_at }
            : { count: 1, reset_at: now + windowMs };
        await write(key, next);
        // Opportunistic cleanup of expired windows for this scope.
        void prune(scope, now).catch(() => {});
      } catch {
        const w = memory.get(key);
        memory.set(
          key,
          w && w.reset_at > now
            ? { count: w.count + 1, reset_at: w.reset_at }
            : { count: 1, reset_at: now + windowMs },
        );
      }
    },

    async reset(id) {
      const key = rowKey(scope, id);
      memory.delete(key);
      try {
        await supabaseAdmin.from("global_settings").delete().eq("key", key);
      } catch {}
    },
  };
}
