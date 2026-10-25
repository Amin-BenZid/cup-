import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSetting, setSetting } from "@/lib/settings";
import { getNotifyPrefs, setNotifyPrefs } from "@/lib/admin-notify";
import { logAdminEvent } from "@/lib/admin-audit";

type Contact = { email: string; phone: string };

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const [contact, notify] = await Promise.all([
      getSetting<Contact>("support_contact"),
      getNotifyPrefs(),
    ]);
    return NextResponse.json(
      {
        contact: { email: contact?.email ?? "", phone: contact?.phone ?? "" },
        notify,
        cronConfigured: !!process.env.CRON_SECRET,
        vapidConfigured:
          !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** { contact?: {email, phone}, notify?: {signup?, support?, billing?} } */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const out: Record<string, unknown> = {};

    if (body?.contact && typeof body.contact === "object") {
      const contact: Contact = {
        email: String(body.contact.email ?? "").trim().slice(0, 120),
        phone: String(body.contact.phone ?? "").trim().slice(0, 40),
      };
      if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }
      await setSetting("support_contact", contact);
      out.contact = contact;
      await logAdminEvent(req, "support_contact_updated");
    }

    if (body?.notify && typeof body.notify === "object") {
      out.notify = await setNotifyPrefs(body.notify);
      await logAdminEvent(req, "notify_prefs_updated", out.notify as Record<string, unknown>);
    }

    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
