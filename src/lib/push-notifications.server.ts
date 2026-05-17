import webpush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PushRole = "customer" | "cyclist";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  user_type: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  role: PushRole;
  url?: string;
  orderId?: string;
  locationLabel?: string;
  eventType?: string;
  icon?: string;
  badge?: string;
};

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function getPushPublicConfig() {
  return {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    serviceWorkerPath: "/sw-push.js",
  };
}

export async function upsertPushSubscription(input: {
  userId: string;
  role: PushRole;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const { error: cleanupError } = await (supabaseAdmin as any)
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", input.endpoint);

  if (cleanupError) {
    throw new Error(cleanupError.message);
  }

  const { error } = await (supabaseAdmin as any).from("push_subscriptions").insert({
    user_id: input.userId,
    user_type: input.role,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function removePushSubscription(input: {
  userId: string;
  role: PushRole;
  endpoint?: string;
}) {
  const query = (supabaseAdmin as any)
    .from("push_subscriptions")
    .delete()
    .eq("user_id", input.userId)
    .eq("user_type", input.role);

  if (input.endpoint) {
    query.eq("endpoint", input.endpoint);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

async function loadSubscriptions(role: PushRole, userId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("push_subscriptions")
    .select("id, user_id, user_type, endpoint, p256dh, auth")
    .eq("user_type", role)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PushSubscriptionRow[];
}

export async function sendPushToUser(role: PushRole, userId: string, payload: PushPayload) {
  if (!ensureVapidConfig()) {
    return { sent: 0, skipped: true as const };
  }

  const subscriptions = await loadSubscriptions(role, userId);
  if (subscriptions.length === 0) {
    return { sent: 0, skipped: false as const };
  }

  const serializedPayload = JSON.stringify({
    ...payload,
    role,
    timestamp: Date.now(),
  });

  let sent = 0;

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        serializedPayload,
      );
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode ?? 0)
          : 0;

      if (statusCode === 404 || statusCode === 410) {
        await (supabaseAdmin as any).from("push_subscriptions").delete().eq("id", row.id);
      }
    }
  }

  return { sent, skipped: false as const };
}

export async function sendPushToCyclistsByNeighborhood(neighborhoodId: string, payload: PushPayload) {
  if (!ensureVapidConfig()) {
    return { sent: 0, targets: 0 };
  }

  const { data: coverageRows, error: coverageError } = await (supabaseAdmin as any)
    .from("cyclist_coverage")
    .select("cyclist_id")
    .eq("neighborhood_id", neighborhoodId);

  if (coverageError) {
    throw new Error(coverageError.message);
  }

  const cyclistIds = Array.from(
    new Set(((coverageRows ?? []) as Array<{ cyclist_id: string }>).map((row) => row.cyclist_id)),
  );

  let sent = 0;
  for (const cyclistId of cyclistIds) {
    const result = await sendPushToUser("cyclist", cyclistId, payload);
    sent += result.sent;
  }

  return { sent, targets: cyclistIds.length };
}