import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import webpush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const pushSchema = z.object({
  user_id: z.string().uuid(),
  target_role: z.enum(["customer", "vendor", "cyclist", "admin"]).optional(),
  payload: z.object({
    title: z.string().min(1).max(120),
    body: z.string().max(300).optional(),
    url: z.string().max(500).optional(),
    icon: z.string().max(500).optional(),
    badge: z.string().max(500).optional(),
  }),
});

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function configureVapid() {
  const vapidSubject = process.env.VAPID_SUBJECT;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    throw new Error("Missing VAPID configuration.");
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export const Route = createFileRoute("/api/public/send-push-notification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          configureVapid();

          const json = await request.json();
          const { user_id, target_role, payload } = pushSchema.parse(json);

          let query = supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", user_id);

          if (target_role) {
            query = query.eq("user_type", target_role);
          }

          const { data: subscriptions, error: subError } = await query;
          if (subError) {
            return Response.json({ error: subError.message }, { status: 500 });
          }

          if (!subscriptions || subscriptions.length === 0) {
            return Response.json({ sent: 0, failed: 0, message: "No subscriptions found." }, { status: 200 });
          }

          let sent = 0;
          let failed = 0;

          for (const subscription of subscriptions as PushSubscriptionRow[]) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                  },
                },
                JSON.stringify(payload),
                {
                  contentEncoding: "aes128gcm",
                  TTL: 60,
                },
              );
              sent += 1;
            } catch (error: any) {
              failed += 1;

              const statusCode = Number(error?.statusCode ?? 0);
              if (statusCode === 404 || statusCode === 410) {
                await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
              }
            }
          }

          return Response.json({ sent, failed }, { status: 200 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to send push notification.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});