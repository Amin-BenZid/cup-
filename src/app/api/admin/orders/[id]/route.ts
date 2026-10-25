import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendOrderReadyPush } from "@/lib/send-push";
import { logAdminEvent } from "@/lib/admin-audit";
import { pingOrder } from "@/lib/realtime";

/** Admin override of an order's status: { status: preparing|ready|done } */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body?.status ?? "");
    if (!["preparing", "ready", "done"].includes(status)) {
      return NextResponse.json({ error: "Bad status" }, { status: 400 });
    }

    const update: Record<string, unknown> = { status };
    if (status === "ready") update.ready_at = new Date().toISOString();
    if (status === "preparing") update.ready_at = null;

    const { data, error } = await supabaseAdmin
      .from("orders")
      .update(update)
      .eq("id", id)
      .select("id, order_number, status, created_at, ready_at, shop_id")
      .maybeSingle();

    if (error) {
      // Re-opening a number that's already active again → unique violation.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That order number is already in use by another active order" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const shopId = data.shop_id as string;
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

    await logAdminEvent(req, "order_status", {
      order: data.order_number,
      shop_id: data.shop_id,
      status,
    });

    return NextResponse.json({ order: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
