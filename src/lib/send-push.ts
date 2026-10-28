import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

let configured = false;

/** Configured web-push instance (shared by customer and admin pushes). */
export function getWebPush() {
  configure();
  return configured ? webpush : null;
}

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.error("VAPID keys missing - push will fail");
    return;
  }

  let subject = process.env.VAPID_SUBJECT || "mailto:hello@cup.app";
  if (!/^(mailto:|https?:)/i.test(subject)) {
    subject = `mailto:${subject}`;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

// Customer push text, in the language the customer was using.
const READY_TEXT: Record<string, { title: string; body: string }> = {
  fr: { title: "Votre commande est prête", body: "Récupérez-la au comptoir" },
  ar: { title: "طلبك جاهز", body: "استلمه من الكاونتر" },
  en: { title: "Your order is ready", body: "Pick it up at the counter" },
};

export async function sendOrderReadyPush(orderId: string) {
  configure();

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("subscription")
    .eq("order_id", orderId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (row) => {
      const { locale, ...subscription } = row.subscription ?? {};
      // Older subscriptions have no language saved: French is the app default.
      const text = READY_TEXT[locale] ?? READY_TEXT.fr;
      const payload = JSON.stringify({ ...text, url: `/o/${orderId}` });
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.subscription.endpoint);
        } else {
          console.error("Push send failed:", err);
        }
      }
    }),
  );
}