import crypto from "node:crypto";
import { deleteSetting, getSetting, listSettings, setSetting } from "@/lib/settings";

/**
 * "Forgot PIN" requests. Nobody can reset a PIN themselves: the café asks
 * from the login page, the admin is notified, calls the phone number on file
 * to check it's really them, then sets a new PIN (which clears the request).
 * Stored in global_settings `pin_reset_request:<shopId>`.
 */

const PIN_RESET_PREFIX = "pin_reset_request:";
/** A new request for the same café within this window reuses the old one. */
export const PIN_RESET_COOLDOWN_MS = 30 * 60 * 1000;
/** Requests older than this are ignored. */
const PIN_RESET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** `refs`: every reference shown to the café for this request (newest last). */
export type PinResetRequest = {
  at: string;
  ref: string;
  refs?: string[];
  last_at?: string;
  /** Number the requester typed in. NOT verified — anyone can type one. */
  callback?: string | null;
};

// No 0/O/1/I so it's easy to read out over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newRef(): string {
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

function fresh(r: PinResetRequest | null): r is PinResetRequest {
  return !!r && Date.now() - new Date(r.last_at ?? r.at).getTime() < PIN_RESET_TTL_MS;
}

export function requestRefs(r: PinResetRequest): string[] {
  return r.refs?.length ? r.refs : [r.ref];
}

export async function getPinResetRequest(shopId: string) {
  const r = await getSetting<PinResetRequest>(PIN_RESET_PREFIX + shopId).catch(() => null);
  return fresh(r) ? r : null;
}

export async function savePinResetRequest(shopId: string, r: PinResetRequest) {
  await setSetting(PIN_RESET_PREFIX + shopId, r);
}

export async function clearPinResetRequest(shopId: string) {
  await deleteSetting(PIN_RESET_PREFIX + shopId).catch(() => {});
}

/** shopId → open request, for admin lists. */
export async function listPinResetRequests(): Promise<Map<string, PinResetRequest>> {
  const rows = await listSettings<PinResetRequest>(PIN_RESET_PREFIX).catch(() => []);
  return new Map(
    rows.filter((r) => fresh(r.value)).map((r) => [r.key.slice(PIN_RESET_PREFIX.length), r.value]),
  );
}
