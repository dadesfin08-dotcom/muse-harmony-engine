import webpush from "web-push";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PushRole = "customer" | "cyclist";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  user_type: string;
  user_role?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_location?: string | null;
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
  tag?: string;
};

type OrderPushEventRow = {
  id: string;
  order_id: string;
  event_type: string;
  status_before: string | null;
  status_after: string | null;
  customer_user_id: string | null;
  neighborhood_id: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
};

export type PushQueueProcessingResult = {
  claimed: number;
  processed: number;
  failed: number;
  sentToCustomers: number;
  sentToCyclists: number;
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

function normalizePushRole(value: unknown): PushRole {
  return String(value ?? "").toLowerCase() === "cyclist" ? "cyclist" : "customer";
}

function mapOrderEventTemplate(input: {
  eventType: string;
  orderId: string;
  statusAfter: string | null;
}) {
  const eventType = String(input.eventType ?? "STATUS_UPDATE").toUpperCase();

  switch (eventType) {
    case "ORDER_CREATED":
      return {
        customer: {
          title: "جاري مراجعة طلبك",
          body: "توصلنا بطلبك بنجاح! الطلب الآن في انتظار موافقة التاجر.",
          url: "/customer#orders",
          eventType: "ORDER_CREATED",
        },
        cyclist: {
          title: "طلب توصيل جديد",
          body: "يوجد طلب جديد متاح في نطاقك. افتح لوحة السائق للقبول.",
          url: "/cyclist/dashboard",
          eventType: "ORDER_CREATED",
        },
      };
    case "MERCHANT_ACCEPTED":
      return {
        customer: {
          title: "تمت الموافقة من التاجر",
          body: "التاجر وافق على طلبك وبدأ التحضير.",
          url: "/customer#orders",
          eventType: "MERCHANT_ACCEPTED",
        },
      };
    case "ORDER_READY":
      return {
        customer: {
          title: "طلبك جاهز",
          body: "تم تجهيز الطلب وهو في انتظار السائق.",
          url: "/customer#orders",
          eventType: "ORDER_READY",
        },
      };
    case "RIDER_PICKED_UP":
      return {
        customer: {
          title: "الطلب في الطريق",
          body: "السائق استلم طلبك وهو الآن في الطريق إليك.",
          url: "/customer#orders",
          eventType: "RIDER_PICKED_UP",
        },
      };
    case "ORDER_COMPLETED":
      return {
        customer: {
          title: "تم التسليم بنجاح",
          body: "تم تسليم الطلب. شكراً لاستخدامك التطبيق.",
          url: "/customer#orders",
          eventType: "ORDER_COMPLETED",
        },
      };
    default:
      return {
        customer: {
          title: "تحديث حالة الطلب",
          body: input.statusAfter
            ? `تم تحديث حالة الطلب إلى ${input.statusAfter}.`
            : "تم تحديث حالة الطلب.",
          url: "/customer#orders",
          eventType: eventType || "STATUS_UPDATE",
        },
      };
  }
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
  locationLabel?: string | null;
}) {
  const normalizedRole = normalizePushRole(input.role);

  const { error } = await (supabaseAdmin as any).from("push_subscriptions").upsert(
    {
      user_id: input.userId,
      user_type: normalizedRole,
      user_role: normalizedRole,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      last_location: input.locationLabel ?? null,
    },
    {
      onConflict: "user_id,endpoint",
      ignoreDuplicates: false,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function removePushSubscription(input: {
  userId: string;
  role: PushRole;
  endpoint?: string;
}) {
  const normalizedRole = normalizePushRole(input.role);

  const query = (supabaseAdmin as any)
    .from("push_subscriptions")
    .delete()
    .eq("user_id", input.userId)
    .eq("user_type", normalizedRole);

  if (input.endpoint) {
    query.eq("endpoint", input.endpoint);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

async function loadSubscriptions(role: PushRole, userId: string) {
  const normalizedRole = normalizePushRole(role);

  const { data, error } = await (supabaseAdmin as any)
    .from("push_subscriptions")
    .select("id, user_id, user_type, user_role, endpoint, p256dh, auth, last_location")
    .eq("user_type", normalizedRole)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PushSubscriptionRow[];
}

async function sendSerializedNotification(subscription: PushSubscriptionRow, serializedPayload: string) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      serializedPayload,
    );

    return { ok: true as const };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode ?? 0)
        : 0;

    if (statusCode === 404 || statusCode === 410) {
      await (supabaseAdmin as any).from("push_subscriptions").delete().eq("id", subscription.id);
    }

    return { ok: false as const };
  }
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
    role: normalizePushRole(role),
    timestamp: Date.now(),
  });

  let sent = 0;

  for (const row of subscriptions) {
    const result = await sendSerializedNotification(row, serializedPayload);
    if (result.ok) sent += 1;
  }

  return { sent, skipped: false as const };
}

export async function sendPushToCyclistsByNeighborhood(neighborhoodId: string, payload: PushPayload) {
  if (!ensureVapidConfig()) {
    return { sent: 0, targets: 0, skipped: true as const };
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
    const result = await sendPushToUser("cyclist", cyclistId, {
      ...payload,
      role: "cyclist",
      locationLabel: payload.locationLabel ?? neighborhoodId,
    });
    sent += result.sent;
  }

  return { sent, targets: cyclistIds.length, skipped: false as const };
}

async function markPushEventProcessed(eventId: string) {
  const { error } = await (supabaseAdmin as any)
    .from("order_push_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_started_at: null,
      last_error: null,
      failed_at: null,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

async function markPushEventFailed(eventId: string, errorMessage: string) {
  const { error } = await (supabaseAdmin as any)
    .from("order_push_events")
    .update({
      processing_started_at: null,
      failed_at: new Date().toISOString(),
      last_error: errorMessage.slice(0, 500),
    })
    .eq("id", eventId);

  if (error) {
    console.error("Failed to update push event failure status:", error.message);
  }
}

async function claimPendingOrderPushEvents(limit: number) {
  const { data, error } = await (supabaseAdmin as any).rpc("claim_order_push_events", {
    p_limit: Math.max(1, Math.min(limit, 100)),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OrderPushEventRow[];
}

export async function processPendingOrderPushEvents(limit = 25): Promise<PushQueueProcessingResult> {
  const summary: PushQueueProcessingResult = {
    claimed: 0,
    processed: 0,
    failed: 0,
    sentToCustomers: 0,
    sentToCyclists: 0,
  };

  if (!ensureVapidConfig()) {
    return summary;
  }

  const events = await claimPendingOrderPushEvents(limit);
  summary.claimed = events.length;

  for (const event of events) {
    try {
      const template = mapOrderEventTemplate({
        eventType: event.event_type,
        orderId: event.order_id,
        statusAfter: event.status_after,
      });

      if (event.customer_user_id && template.customer) {
        const customerResult = await sendPushToUser("customer", event.customer_user_id, {
          title: template.customer.title,
          body: template.customer.body,
          role: "customer",
          url: template.customer.url,
          orderId: event.order_id,
          locationLabel: event.neighborhood_id ?? undefined,
          eventType: template.customer.eventType,
          tag: `order-${event.order_id}-${template.customer.eventType}`,
        });

        summary.sentToCustomers += customerResult.sent;
      }

      if (event.neighborhood_id && template.cyclist) {
        const cyclistResult = await sendPushToCyclistsByNeighborhood(event.neighborhood_id, {
          title: template.cyclist.title,
          body: template.cyclist.body,
          role: "cyclist",
          url: template.cyclist.url,
          orderId: event.order_id,
          locationLabel: event.neighborhood_id,
          eventType: template.cyclist.eventType,
          tag: `order-${event.order_id}-${template.cyclist.eventType}`,
        });

        summary.sentToCyclists += cyclistResult.sent;
      }

      await markPushEventProcessed(event.id);
      summary.processed += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : "Unknown push processing error";
      await markPushEventFailed(event.id, message);
    }
  }

  return summary;
}
