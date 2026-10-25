import { NextRequest, NextResponse } from "next/server";
import { getPublicOrder } from "@/lib/public-order";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const resolved = await ctx.params;
    const id = resolved?.id;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const result = await getPublicOrder(id);

    if (!result.ok) {
      if (result.notFound) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      console.error("[o/[id]]", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(
      { order: result.order, shop: result.shop },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
