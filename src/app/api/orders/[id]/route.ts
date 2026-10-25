import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShop } from "@/lib/shop-auth";
import { sendOrderReadyPush } from "@/lib/send-push";
import { pingOrder } from "@/lib/realtime";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolved = await ctx.params;
    const id = resolved.id;

    if (!id) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    // Ownership: only the shop that owns this order may change it.
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("shop_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const guard = await requireShop(existing.shop_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await req.json().catch(() => ({}));
    const status = (body?.status ?? "").toString();

    if (!["preparing", "ready", "done"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const update: Record<string, unknown> = { status };
    if (status === "ready") update.ready_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Must run inside the invocation, or Vercel can freeze before it sends.
    // Live ping first (customer page rings instantly), then the web push.
    const shopId = existing.shop_id as string;
    after(async () => {
      await pingOrder(id, shopId);
      if (status === "ready") {
        try {
          await sendOrderReadyPush(id);
        } catch (e) {
          console.error("Push error:", e);
        }
      }
    });

    return NextResponse.json({ order: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}