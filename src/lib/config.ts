/**
 * App-wide settings that used to be hard-coded. Override them in the env.
 * NEXT_PUBLIC_* values are inlined at build time and safe for client code.
 */

/** Monthly subscription price in TND. Used for the admin MRR estimate. */
export const MONTHLY_PRICE_TND =
  Number(process.env.NEXT_PUBLIC_MONTHLY_PRICE_TND) || 25;

/**
 * Dev only: LAN address of this machine, so QR codes generated on localhost
 * point somewhere a phone can reach. Unset = use the current origin.
 */
export const DEV_LAN_IP = process.env.NEXT_PUBLIC_DEV_LAN_IP || "";
