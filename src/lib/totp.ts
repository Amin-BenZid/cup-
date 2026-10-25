import crypto from "crypto";

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s), compatible with Google
 * Authenticator, 1Password, iOS Passwords, Authy, etc.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 20 random bytes, base32 (the standard size for SHA-1 TOTP). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function currentCounter(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

export function totpAt(secretB32: string, counter: number): string {
  const key = base32Decode(secretB32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin =
    ((h[offset] & 0x7f) << 24) |
    (h[offset + 1] << 16) |
    (h[offset + 2] << 8) |
    h[offset + 3];
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/**
 * Returns the matched counter (accepting ±1 step of clock drift), or null.
 * Pass `lastUsedCounter` to reject replays of an already-used code.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  lastUsedCounter = -1,
  nowMs = Date.now(),
): number | null {
  const c = (code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = currentCounter(nowMs);
  for (const counter of [now - 1, now, now + 1]) {
    if (counter <= lastUsedCounter) continue;
    const expected = totpAt(secretB32, counter);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) {
      return counter;
    }
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
