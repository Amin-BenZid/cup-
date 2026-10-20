import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function clip(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const message = clip(body?.message, 500);
    if (!message) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await supabaseAdmin.from("client_errors").insert({
      message,
      stack: clip(body?.stack, 4000),
      url: clip(body?.url, 500),
      user_agent: clip(req.headers.get("user-agent"), 300),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never let logging break the page.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}