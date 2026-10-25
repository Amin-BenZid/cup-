import crypto from "crypto";
import { promisify } from "util";

/**
 * PIN hashing: HMAC-SHA256 with a server-side pepper, then scrypt with a
 * per-shop random salt. See docs/pin-hash-migration.md.
 *
 * Stored formats in shops.pin_hash:
 *   v2$scrypt$N=16384,r=8,p=1$<salt>$<hash>    current
 *   v1w$scrypt$N=16384,r=8,p=1$<salt>$<hash>   legacy sha256 hex, wrapped by
 *                                               scripts/wrap-legacy-pins.mjs
 *   <64 hex chars>                              legacy unsalted sha256(pin)
 *
 * Server only (Node runtime).
 */

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 32;
const SALT_BYTES = 16;
const MAXMEM = 64 * 1024 * 1024;

const LEGACY_HEX = /^[0-9a-f]{64}$/;

function pepper(): string {
  const p = process.env.PIN_PEPPER;
  // Never fall back to an unpeppered hash.
  if (!p || p.length < 16) throw new Error("PIN_PEPPER not set");
  return p;
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function peppered(input: string): Buffer {
  return crypto.createHmac("sha256", pepper()).update(input).digest();
}

type Params = { N: number; r: number; p: number };

function encodeParams(p: Params) {
  return `N=${p.N},r=${p.r},p=${p.p}`;
}

function decodeParams(s: string): Params | null {
  const m = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(s);
  if (!m) return null;
  return { N: Number(m[1]), r: Number(m[2]), p: Number(m[3]) };
}

async function derive(input: string, salt: Buffer, p: Params) {
  return scrypt(peppered(input), salt, KEYLEN, {
    N: p.N,
    r: p.r,
    p: p.p,
    maxmem: MAXMEM,
  });
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Hash a PIN for storage (always the current v2 format, fresh salt). */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await derive(pin, salt, PARAMS);
  return [
    "v2",
    "scrypt",
    encodeParams(PARAMS),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export type VerifyResult = { ok: boolean; needsRehash: boolean };

/** Verify a PIN against any supported stored format. */
export async function verifyPin(
  pin: string,
  stored: string | null | undefined,
): Promise<VerifyResult> {
  if (!stored) return { ok: false, needsRehash: false };

  // Legacy: unsalted sha256 hex.
  if (LEGACY_HEX.test(stored)) {
    const ok = safeEqual(
      Buffer.from(sha256Hex(pin), "hex"),
      Buffer.from(stored, "hex"),
    );
    return { ok, needsRehash: ok };
  }

  const parts = stored.split("$");
  if (parts.length !== 5 || parts[1] !== "scrypt") {
    return { ok: false, needsRehash: false };
  }
  const [version, , paramStr, saltB64, hashB64] = parts;
  const params = decodeParams(paramStr);
  if (!params || (version !== "v2" && version !== "v1w")) {
    return { ok: false, needsRehash: false };
  }

  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  // v1w wraps the old sha256 hex, so feed that in instead of the raw PIN.
  const input = version === "v1w" ? sha256Hex(pin) : pin;
  const actual = await derive(input, salt, params);
  const ok = safeEqual(actual, expected);

  const outdated =
    version !== "v2" ||
    params.N < PARAMS.N ||
    params.r < PARAMS.r ||
    params.p < PARAMS.p;

  return { ok, needsRehash: ok && outdated };
}
