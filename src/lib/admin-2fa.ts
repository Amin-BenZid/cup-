import { getSetting, setSetting, deleteSetting } from "@/lib/settings";
import { seal, open } from "@/lib/secret-box";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

/**
 * Admin two-factor auth (TOTP). The secret is stored encrypted in
 * global_settings. Emergency off-switch: set ADMIN_2FA_RESET=1 in the env
 * (see docs/admin.md), log in, re-enrol, then remove the variable.
 */

const ACTIVE_KEY = "admin_totp";
const PENDING_KEY = "admin_totp_pending";
const PENDING_TTL_MS = 15 * 60 * 1000;

type Active = { box: string; enabled_at: string; last_counter: number };
type Pending = { box: string; created_at: number };

function resetSwitchOn() {
  return process.env.ADMIN_2FA_RESET === "1";
}

export async function twoFactorStatus(): Promise<{
  enabled: boolean;
  enabledAt: string | null;
  resetSwitch: boolean;
}> {
  const active = await getSetting<Active>(ACTIVE_KEY);
  return {
    enabled: !!active?.box && !resetSwitchOn(),
    enabledAt: active?.enabled_at ?? null,
    resetSwitch: resetSwitchOn(),
  };
}

export async function isTwoFactorEnabled(): Promise<boolean> {
  if (resetSwitchOn()) return false;
  const active = await getSetting<Active>(ACTIVE_KEY);
  return !!active?.box;
}

/** Verify a login code against the active secret (with replay protection). */
export async function verifyAdminCode(code: string): Promise<boolean> {
  const active = await getSetting<Active>(ACTIVE_KEY);
  if (!active?.box) return false;
  const secret = open(active.box);
  if (!secret) return false;
  const counter = verifyTotp(secret, code, active.last_counter ?? -1);
  if (counter === null) return false;
  await setSetting(ACTIVE_KEY, { ...active, last_counter: counter });
  return true;
}

/** Start enrolment: create a pending secret and return it for the QR code. */
export async function beginEnrolment(account: string) {
  const secret = generateTotpSecret();
  await setSetting(PENDING_KEY, { box: seal(secret), created_at: Date.now() });
  return { secret, uri: otpauthUri(secret, account, "Beep Admin") };
}

/** Finish enrolment: the code must match the pending secret. */
export async function confirmEnrolment(code: string): Promise<boolean> {
  const pending = await getSetting<Pending>(PENDING_KEY);
  if (!pending?.box || Date.now() - pending.created_at > PENDING_TTL_MS) {
    return false;
  }
  const secret = open(pending.box);
  if (!secret) return false;
  const counter = verifyTotp(secret, code);
  if (counter === null) return false;
  await setSetting(ACTIVE_KEY, {
    box: pending.box,
    enabled_at: new Date().toISOString(),
    last_counter: counter,
  });
  await deleteSetting(PENDING_KEY);
  return true;
}

export async function disableTwoFactor() {
  await deleteSetting(ACTIVE_KEY);
  await deleteSetting(PENDING_KEY).catch(() => {});
}
