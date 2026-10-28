/**
 * Shop login codes are slugs like "my-coffee". People type them the way the
 * shop is called ("My Coffee"), so spaces become dashes everywhere a code is
 * entered, and the server normalises the same way before looking it up.
 */

/** While typing: lowercase, any space → "-", no double dashes. */
export function typeShopCode(v: string): string {
  return v.toLowerCase().replace(/\s/g, "-").replace(/-{2,}/g, "-");
}

/** Before lookup: trim, lowercase, spaces → "-", no double dashes. */
export function normalizeShopCode(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, "-").replace(/-{2,}/g, "-");
}
