import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { hashPin } from "@/lib/pin";
import { logAdminEvent } from "@/lib/admin-audit";
import { avg, DAY_MS, dayKey, deriveShopState, fetchAllRows, lastNDays, prepSeconds } from "@/lib/admin-stats";

const SHOP_FIELDS =
  "id, name, tagline, status, created_at, code, phone, logo_url, logo_scale, logo_offset_x, logo_offset_y, theme, game, messages, trial_ends_at, subscription_ends_at, billing_status, paid_current_month, login_attempts, locked_until, has_created_order";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;

    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select(SHOP_FIELDS)
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const [ordersRes, reviewsRes, historyRes, messagesRes, recentRes, totalRes] =
      await Promise.all([
        supabaseAdmin
          .from("orders")
          .select("id, order_number, status, created_at, ready_at, customer_connected, customer_phone")
          .eq("shop_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("reviews")
          .select("rating, comment, created_at")
          .eq("shop_id", id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabaseAdmin
          .from("shop_history")
          .select("id, action, details, created_at")
          .eq("shop_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("support_messages")
          .select("id, message, sender, is_read, created_at")
          .eq("shop_id", id)
          .order("created_at", { ascending: false })
          .limit(5),
        fetchAllRows<{ created_at: string; ready_at: string | null; customer_connected: boolean }>((a, b) =>
          supabaseAdmin
            .from("orders")
            .select("created_at, ready_at, customer_connected")
            .eq("shop_id", id)
            .gte("created_at", since30)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(a, b),
        ),
        supabaseAdmin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", id),
      ]);

    const reviews = reviewsRes.data ?? [];
    const reviewCount = reviews.length;
    const avgRating = reviewCount
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount
      : 0;

    // 30-day stats for the detail page.
    const recent = recentRes.rows;
    const prepTimes = recent.map(prepSeconds).filter((x): x is number => x !== null);
    const avgPrep = avg(prepTimes);
    const avgPrepSec = avgPrep === null ? null : Math.round(avgPrep);
    const connectRate = recent.length
      ? Math.round((recent.filter((o) => o.customer_connected).length / recent.length) * 100)
      : null;

    const byDay: Record<string, number> = {};
    for (const o of recent) {
      const k = dayKey(o.created_at);
      byDay[k] = (byDay[k] ?? 0) + 1;
    }

    return NextResponse.json(
      {
        shop: { ...shop, ...deriveShopState(shop) },
        orders: ordersRes.data ?? [],
        reviews,
        history: historyRes.data ?? [],
        messages: messagesRes.data ?? [],
        reviewStats: { count: reviewCount, average: Math.round(avgRating * 10) / 10 },
        stats: {
          total: totalRes.count ?? 0,
          last30: recent.length,
          avgPrepSec,
          connectRate,
          daily: lastNDays(30).map((d) => ({ day: d, count: byDay[d] ?? 0 })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDate(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

/**
 * Partial update. Accepted fields:
 *   name, tagline, code, phone, status (pending|active|disabled),
 *   trial_ends_at, subscription_ends_at (ISO or null), paid_current_month,
 *   billing_status (trial|active), new_pin (6 digits), unlock (true)
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const { data: before, error: beforeErr } = await supabaseAdmin
      .from("shops")
      .select("name, code, status")
      .eq("id", id)
      .maybeSingle();
    if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 500 });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const update: Record<string, unknown> = {};
    const logs: { action: string; details: Record<string, unknown> }[] = [];
    const edited: string[] = [];

    if (typeof body.name === "string") {
      const name = body.name.trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
      if (name !== before.name) {
        update.name = name;
        logs.push({ action: "renamed", details: { from: before.name, new_name: name } });
      }
    }

    if (typeof body.tagline === "string") {
      update.tagline = body.tagline.trim().slice(0, 80) || null;
      edited.push("tagline");
    }

    if (typeof body.phone === "string") {
      const phone = body.phone.replace(/[^\d+]/g, "").slice(0, 20);
      update.phone = phone || null;
      edited.push("phone");
    }

    if (typeof body.code === "string") {
      const code = slugify(body.code).slice(0, 40);
      if (code.length < 3) {
        return NextResponse.json({ error: "Code must be at least 3 letters/numbers" }, { status: 400 });
      }
      if (code !== before.code) {
        const { data: taken } = await supabaseAdmin
          .from("shops")
          .select("id")
          .eq("code", code)
          .neq("id", id)
          .maybeSingle();
        if (taken) return NextResponse.json({ error: "That café code is taken" }, { status: 409 });
        update.code = code;
        logs.push({ action: "code_changed", details: { from: before.code, to: code } });
      }
    }

    if (typeof body.status === "string") {
      if (!["pending", "active", "disabled"].includes(body.status)) {
        return NextResponse.json({ error: "Bad status" }, { status: 400 });
      }
      if (body.status !== before.status) {
        update.status = body.status;
        logs.push({
          action: body.status === "active" ? "approved" : body.status === "disabled" ? "disabled" : "set_pending",
          details: { from: before.status },
        });
      }
    }

    for (const field of ["trial_ends_at", "subscription_ends_at"] as const) {
      if (field in body) {
        const v = parseDate(body[field]);
        if (v === undefined) return NextResponse.json({ error: `Bad date for ${field}` }, { status: 400 });
        update[field] = v;
        logs.push({ action: "billing_set", details: { [field]: v } });
      }
    }

    if (typeof body.paid_current_month === "boolean") {
      update.paid_current_month = body.paid_current_month;
      edited.push("paid_current_month");
    }

    if (typeof body.billing_status === "string") {
      if (!["trial", "active"].includes(body.billing_status)) {
        return NextResponse.json({ error: "Bad billing status" }, { status: 400 });
      }
      update.billing_status = body.billing_status;
      edited.push("billing_status");
    }

    if (typeof body.new_pin === "string") {
      if (!/^\d{6}$/.test(body.new_pin)) {
        return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
      }
      update.pin_hash = await hashPin(body.new_pin);
      update.login_attempts = 0;
      update.locked_until = null;
      logs.push({ action: "pin_reset", details: {} });
    }

    if (body.unlock === true) {
      update.login_attempts = 0;
      update.locked_until = null;
      logs.push({ action: "unlocked", details: {} });
    }

    if (edited.length) logs.push({ action: "edited", details: { fields: edited } });

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("shops")
      .update(update)
      .eq("id", id)
      .select(SHOP_FIELDS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "That café code is taken" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (logs.length) {
      await supabaseAdmin
        .from("shop_history")
        .insert(logs.map((l) => ({ shop_id: id, action: l.action, details: l.details })));
    }
    await logAdminEvent(req, "shop_updated", {
      shop: data.name,
      actions: logs.map((l) => l.action),
    });

    return NextResponse.json({ shop: { ...data, ...deriveShopState(data) } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("name, code")
      .eq("id", id)
      .maybeSingle();
    if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Typed confirmation: the client must send the café code.
    if (String(body?.confirm ?? "") !== shop.code) {
      return NextResponse.json({ error: "Type the café code to confirm" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("shops").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminEvent(req, "shop_deleted", { shop: shop.name, code: shop.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
