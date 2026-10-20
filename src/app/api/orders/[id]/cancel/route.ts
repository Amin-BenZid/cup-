import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// The customer may only cancel an order that has been sitting untouched.
const MIN_AGE_MS = 20 * 60 * 1000;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await ctx.params;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, created_at")
      .eq("id", id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "preparing") {
      return NextResponse.json({ error: "Cannot cancel" }, { status: 409 });
    }

    const age = Date.now() - new Date(order.created_at).getTime();
    if (!(age > MIN_AGE_MS)) {
      return NextResponse.json(
        { error: "Too early to cancel" },
        { status: 409 },
      );
    }

    // "done" is what frees the order number and removes it from the queue.
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "done" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}