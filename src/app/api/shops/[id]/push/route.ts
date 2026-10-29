import { NextRequest, NextResponse } from "next/server";
import { requireShopAuth } from "@/lib/shop-auth";
import { isValidSubscription, removeShopDevice, saveShopDevice } from "@/lib/shop-notify";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

/**
 * POST   { subscription, locale } — this staff phone wants notifications
 * DELETE { endpoint }             — it doesn't any more
 *
 * Identity only (requireShopAuth): a paused or expired shop can still hear
 * from the Beep team. Archived and deleted shops are refused.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireShopAuth(id);
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });
  const body = await req.json().catch(() => ({}));
  if (!isValidSubscription(body?.subscription)) {
    return NextResponse.json({ error: "Bad subscription", code: "BAD_SUBSCRIPTION" }, { status: 400 });
  }
  await saveShopDevice(guard.shopId, body.subscription, String(body?.locale ?? "fr"));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await requireShopAuth(id);
  if (!guard.ok) return NextResponse.json({ error: guard.error, code: guard.code }, { status: guard.status });
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body?.endpoint ?? "");
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await removeShopDevice(guard.shopId, endpoint);
  return NextResponse.json({ ok: true });
}
