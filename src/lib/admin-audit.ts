import { getSetting, setSetting } from "@/lib/settings";
import { clientIp } from "@/lib/admin-auth";

/**
 * Admin security/audit log kept in global_settings.admin_audit (last 200
 * entries). Logging must never break the request, so all errors are swallowed.
 */

const KEY = "admin_audit";
const MAX = 200;

export type AuditEntry = {
  at: string;
  event: string;
  ok: boolean;
  ip: string;
  ua: string;
  details?: Record<string, unknown>;
};

export async function logAdminEvent(
  req: Request | null,
  event: string,
  details?: Record<string, unknown>,
  ok = true,
) {
  try {
    const entry: AuditEntry = {
      at: new Date().toISOString(),
      event,
      ok,
      ip: req ? clientIp(req) : "system",
      ua: req ? (req.headers.get("user-agent") ?? "").slice(0, 200) : "",
      ...(details ? { details } : {}),
    };
    const list = (await getSetting<AuditEntry[]>(KEY)) ?? [];
    const next = [entry, ...(Array.isArray(list) ? list : [])].slice(0, MAX);
    await setSetting(KEY, next);
  } catch (e) {
    console.error("[admin-audit]", e);
  }
}

export async function readAdminAudit(): Promise<AuditEntry[]> {
  try {
    const list = await getSetting<AuditEntry[]>(KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
