import crypto from "crypto";

/**
 * AES-256-GCM encryption for small secrets stored in the database (e.g. the
 * admin TOTP secret), keyed from ADMIN_SECRET. A database leak alone then
 * reveals nothing usable.
 *
 * NOTE: rotating ADMIN_SECRET makes existing boxes undecryptable (2FA would
 * have to be set up again; see ADMIN_2FA_RESET in docs/admin.md).
 */

function key(): Buffer {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET not set");
  return crypto.createHash("sha256").update(`secret-box:v1:${s}`).digest();
}

export function seal(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function open(box: string): string | null {
  try {
    const [v, ivB, tagB, encB] = box.split(".");
    if (v !== "v1" || !ivB || !tagB || !encB) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivB, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encB, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
