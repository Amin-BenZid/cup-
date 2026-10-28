import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeShopCode } from "@/lib/shop-code";
import { normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/admin-auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { notifyAdmin } from "@/lib/admin-notify";
import { getArchive } from "@/lib/shop-archive";
import {
  PIN_RESET_COOLDOWN_MS,
  getPinResetRequest,
  newRef,
  requestRefs,
  savePinResetRequest,
} from "@/lib/pin-reset";

// 5 requests per IP per hour.
const limiter = createRateLimiter("pin_forgot", 5, 60 * 60 * 1000);

/**
 * POST { code } — ask the Beep team for a new PIN.
 *
 * Always answers the same way whether the café exists or not (no way to
 * probe which codes are real) and never changes the PIN. It only leaves a
 * request for the admin, who verifies by calling the café's phone on file.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (await limiter.isBlocked(ip)) {
      return NextResponse.json(
        { error: "too_many", message: "Too many requests. Try again later or contact support." },
        { status: 429 },
      );
    }
    await limiter.fail(ip);

    const body = await req.json().catch(() => ({}));
    const code = normalizeShopCode((body?.code ?? "").toString()).slice(0, 60);
    if (code.length < 3) {
      return NextResponse.json({ error: "code_required" }, { status: 400 });
    }
    // Optional number to call back. Same check for every caller, so it says
    // nothing about whether the shop exists.
    const rawPhone = String(body?.phone ?? "").trim();
    const callback = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !callback) {
      return NextResponse.json({ error: "Invalid phone number", code: "INVALID_PHONE" }, { status: 400 });
    }

    // Every outcome gets a brand-new reference and the same response, so a
    // caller can't tell whether the code exists. Writes run after the
    // response so timing doesn't tell either.
    const ref = newRef();

    const find = (c: string) =>
      supabaseAdmin.from("shops").select("id, name").eq("code", c).maybeSingle();
    let { data: shop } = await find(code);
    const bare = code.replace(/^-+|-+$/g, "");
    if (!shop && bare && bare !== code) ({ data: shop } = await find(bare));

    if (shop) {
      const { id: shopId, name } = shop;
      after(async () => {
        if (await getArchive(shopId)) return;
        const now = new Date().toISOString();
        const existing = await getPinResetRequest(shopId);
        if (existing && Date.now() - new Date(existing.last_at ?? existing.at).getTime() < PIN_RESET_COOLDOWN_MS) {
          // Asked again recently: remember the new reference, don't re-notify.
          await savePinResetRequest(shopId, {
            ...existing,
            ref,
            refs: [...requestRefs(existing), ref].slice(-5),
            last_at: now,
            callback: callback ?? existing.callback ?? null,
          });
          return;
        }
        await savePinResetRequest(shopId, { at: now, last_at: now, ref, refs: [ref], callback });
        await supabaseAdmin.from("support_messages").insert({
          shop_id: shopId,
          message:
            `🔑 Forgot PIN — new PIN requested from the login page (ref ${ref}). ` +
            (callback ? `They left the number ${callback} (not verified). ` : "") +
            `Call the shop's phone number on file to confirm it's them before setting a new PIN.`,
          sender: "barista",
          is_read: false,
        });
        await supabaseAdmin
          .from("shop_history")
          .insert({ shop_id: shopId, action: "pin_reset_requested", details: { ref } });
        await notifyAdmin({
          kind: "support",
          title: `PIN reset request · ${name}`,
          body: `Ref ${ref}. Call the shop to confirm, then set a new PIN.`,
          url: `/admin/shops/${shopId}`,
        });
      });
    }

    return NextResponse.json({ ok: true, ref });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
