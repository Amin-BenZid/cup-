import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isAdminAuthed } from "@/lib/admin-auth";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("global_settings")
    .select("value")
    .eq("key", "support_contact")
    .maybeSingle();

  let value = data?.value ?? { email: "", phone: "" };
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {}
  }

  return NextResponse.json({ contact: value });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().slice(0, 120);
  const phone = String(body?.phone ?? "").trim().slice(0, 40);

  const { error } = await supabaseAdmin
    .from("global_settings")
    .upsert(
      { key: "support_contact", value: { email, phone } },
      { onConflict: "key" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contact: { email, phone } });
}