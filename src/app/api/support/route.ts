import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShopAuth } from "@/lib/shop-auth";
import { notifyAdmin } from "@/lib/admin-notify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const shop_id = (body?.shop_id ?? "").toString();
    const message = (body?.message ?? "").toString().trim();

    if (!shop_id || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Support must work for expired shops too — identity, not entitlement.
    const guard = await requireShopAuth(shop_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const { data, error } = await supabaseAdmin
      .from("support_messages")
      .insert({
        shop_id: guard.shopId,
        message,
        sender: "barista",
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Barista support insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ping the admin's phone (at most once per shop every 2 minutes).
    const shopId = guard.shopId;
    after(async () => {
      const { data: shop } = await supabaseAdmin
        .from("shops")
        .select("name")
        .eq("id", shopId)
        .maybeSingle();
      await notifyAdmin({
        kind: "support",
        title: `Message from ${shop?.name ?? "a café"}`,
        body: message.length > 140 ? `${message.slice(0, 137)}…` : message,
        url: `/admin/support?shop=${shopId}`,
        throttleKey: `support:${shopId}`,
        throttleMs: 2 * 60 * 1000,
      });
    });

    return NextResponse.json({ message: data });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const shop_id = req.nextUrl.searchParams.get("shop_id");
    if (!shop_id) {
      return NextResponse.json({ error: "shop_id required" }, { status: 400 });
    }

    const guard = await requireShopAuth(shop_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const { data, error } = await supabaseAdmin
      .from("support_messages")
      .select("*")
      .eq("shop_id", guard.shopId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const unread = (data ?? []).filter(
      (m) => m.sender === "admin" && !m.is_read,
    ).length;

    return NextResponse.json(
      { messages: data ?? [], unread },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const shop_id = (body?.shop_id ?? "").toString();

    if (!shop_id) {
      return NextResponse.json({ error: "Missing shop_id" }, { status: 400 });
    }

    const guard = await requireShopAuth(shop_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    await supabaseAdmin
      .from("support_messages")
      .update({ is_read: true })
      .eq("shop_id", guard.shopId)
      .eq("sender", "admin")
      .eq("is_read", false);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}