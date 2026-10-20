import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const FALLBACK = { email: "aminebenzid2003@gmail.com", phone: "" };

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("global_settings")
      .select("value")
      .eq("key", "support_contact")
      .maybeSingle();

    let value = data?.value ?? FALLBACK;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = FALLBACK;
      }
    }

    return NextResponse.json(
      {
        email: String(value?.email ?? FALLBACK.email),
        phone: String(value?.phone ?? ""),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(FALLBACK);
  }
}