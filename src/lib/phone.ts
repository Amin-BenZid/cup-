/**
 * Phone numbers as stored on a shop: "+" and digits only.
 * 8 digits with no country code are taken as Tunisian (+216).
 * Returns null when it can't be a real number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "");
  if (!raw) return null;
  let digits: string;
  if (raw.startsWith("+")) digits = raw.slice(1);
  else if (raw.startsWith("00")) digits = raw.slice(2);
  else if (/^\d{8}$/.test(raw)) digits = "216" + raw;
  else digits = raw;
  if (!/^\d{8,15}$/.test(digits)) return null;
  return "+" + digits;
}
