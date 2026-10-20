import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShop } from "@/lib/shop-auth";

type CreateOrderBody = {
  shop_id?: unknown;
  order_number?: unknown;
  customer_phone?: unknown;
};

export async function POST(req: NextRequest) {
  let body: CreateOrderBody;

  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const shop_id = String(body?.shop_id ?? "").trim();
  const suppliedNumber = String(body?.order_number ?? "").trim();
  const rawPhone = String(body?.customer_phone ?? "").trim();

  if (!shop_id) {
    return NextResponse.json({ error: "shop_id required" }, { status: 400 });
  }

  // Authentication: a signed session must own this shop.
  const guard = await requireShop(shop_id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  // A number is only sent when the barista edited it.
  if (suppliedNumber && !/^\d{1,4}$/.test(suppliedNumber)) {
    return NextResponse.json(
      { error: "Order number must be 1 to 4 digits" },
      { status: 400 },
    );
  }

  let customer_phone: string | null = null;
  if (rawPhone) {
    const cleaned = rawPhone.replace(/[\s\-().]/g, "");
    if (!/^\+?\d{6,20}$/.test(cleaned)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 },
      );
    }
    customer_phone = cleaned;
  }

  try {
    // Single round trip: claims the number (if p_number is empty), inserts the
    // order and flags the shop for onboarding — all inside one SQL function.
    const { data, error } = await supabaseAdmin.rpc("create_order", {
      p_shop_id: guard.shopId,
      p_number: suppliedNumber,
      p_phone: customer_phone,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { code: "DUPLICATE_ORDER_NUMBER", error: error.message },
          { status: 409 },
        );
      }

      if (error.code === "23503") {
        return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }

      console.error("[orders POST]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // PostgREST returns a composite as an object, but tolerate an array.
    const order = Array.isArray(data) ? data[0] : data;

    if (!order) {
      return NextResponse.json(
        { error: "Order was not created" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { order },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[orders POST] crash:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}