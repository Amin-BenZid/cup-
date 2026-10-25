// One-off: wrap every legacy unsalted sha256 PIN hash into v1w (scrypt +
// salt + pepper) so no weak hash stays in the DB. Shops upgrade to v2 on
// their next login. See docs/pin-hash-migration.md, step 2.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/wrap-legacy-pins.mjs           # dry run
//   node --env-file=.env.local scripts/wrap-legacy-pins.mjs --apply   # write
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the SAME
// PIN_PEPPER as production. Must stay in sync with src/lib/pin.ts.

import crypto from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 16384, r: 8, p: 1 };
const LEGACY_HEX = /^[0-9a-f]{64}$/;
const apply = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.PIN_PEPPER;
if (!url || !key) throw new Error("Supabase env vars missing");
if (!pepper || pepper.length < 16) throw new Error("PIN_PEPPER missing");

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function wrap(legacyHex) {
  const salt = crypto.randomBytes(16);
  const keyed = crypto.createHmac("sha256", pepper).update(legacyHex).digest();
  const hash = await scrypt(keyed, salt, 32, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return [
    "v1w",
    "scrypt",
    `N=${PARAMS.N},r=${PARAMS.r},p=${PARAMS.p}`,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

const { data: shops, error } = await db.from("shops").select("id, code, pin_hash");
if (error) throw error;

const legacy = shops.filter((s) => LEGACY_HEX.test(s.pin_hash ?? ""));
console.log(`${shops.length} shops, ${legacy.length} with a legacy hash.`);
if (!apply) {
  console.log("Dry run. Re-run with --apply to wrap them.");
  process.exit(0);
}

let done = 0;
let skipped = 0;
for (const s of legacy) {
  const next = await wrap(s.pin_hash);
  // Only replace the exact old value, so a concurrent login upgrade or
  // admin PIN reset is never overwritten.
  const { data, error: upErr } = await db
    .from("shops")
    .update({ pin_hash: next })
    .eq("id", s.id)
    .eq("pin_hash", s.pin_hash)
    .select("id");
  if (upErr) {
    console.error(`  ${s.code}: ${upErr.message}`);
    continue;
  }
  if (data?.length) done++;
  else skipped++;
}

const { data: after } = await db.from("shops").select("pin_hash");
const left = (after ?? []).filter((s) => LEGACY_HEX.test(s.pin_hash ?? "")).length;
console.log(`Wrapped ${done}, skipped ${skipped} (changed meanwhile). Legacy left: ${left}.`);
