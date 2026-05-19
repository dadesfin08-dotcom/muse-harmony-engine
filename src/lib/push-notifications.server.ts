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
  triggeredWorkflows: number;
};

type WorkflowName = "order-accepted-alert" | "order-out-for-delivery" | "cyclist-broadcast-alert";

type OrderWebhookContext = {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  deliveryFee: number;
  paymentMethod: string | null;
  vendorName: string;
  cyclistName: string;
  pickupLocation: string;
  cyclistPhones: string[];
  neighborhoodId: string | null;
};

function sanitizeOrderId(orderId: string | null | undefined) {
  const normalized = String(orderId ?? "").trim();
  if (!normalized) return "UNKNOWN";
  return normalized;
}

function formatOrderReference(orderId: string | null | undefined) {
  const normalized = sanitizeOrderId(orderId);
  const compact = normalized.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const shortCode = compact.slice(0, 4);
  return `#${shortCode || "UNKNOWN"}`;
}

function buildOrderIdLine(orderId: string | null | undefined, locale: "ar" | "en") {
  const reference = formatOrderReference(orderId);
  return locale === "ar" ? `رقم الطلب: ${reference}` : `Order ID: ${reference}`;
}

const WORKFLOW_WEBHOOK_BASE_URL = "https://n8n.srv961724.hstgr.cloud/webhook";
const WORKFLOW_MAX_RETRIES = 3;

function getWorkflowFromOrderEvent(eventType: string): WorkflowName | null {
  const normalized = String(eventType ?? "").toUpperCase();

  if (normalized === "MERCHANT_ACCEPTED") return "order-accepted-alert";
  if (normalized === "RIDER_PICKED_UP") return "order-out-for-delivery";
  if (normalized === "ORDER_READY") return "cyclist-broadcast-alert";
  return null;
}

async function delay(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildWorkflowPayload(workflow: WorkflowName, context: OrderWebhookContext) {
  const resolvedOrderId = sanitizeOrderId(context.id);

  switch (workflow) {
    case "order-accepted-alert":
      return {
        order_id: resolvedOrderId,
        event_type: "MERCHANT_ACCEPTED",
        customer_name: context.customerName,
        customer_phone: context.customerPhone,
        vendor_name: context.vendorName,
        total: context.total,
      };
    case "order-out-for-delivery":
      {
        const orderIdLineAr = buildOrderIdLine(resolvedOrderId, "ar");
        const orderIdLineEn = buildOrderIdLine(resolvedOrderId, "en");
        return {
          order_id: resolvedOrderId,
          order_reference: formatOrderReference(resolvedOrderId),
        event_type: "RIDER_PICKED_UP",
        total: context.total,
        customer_phone: context.customerPhone,
        customer_name: context.customerName,
        cyclist_name: context.cyclistName,
        payment_method: context.paymentMethod,
          message_ar: `الطلب في الطريق\n${orderIdLineAr}`,
          message_en: `Order is out for delivery\n${orderIdLineEn}`,
          order_id_line_ar: orderIdLineAr,
          order_id_line_en: orderIdLineEn,
          realtime_notification_ar: `الطلب في الطريق\n${orderIdLineAr}`,
          realtime_notification_en: `Order is out for delivery\n${orderIdLineEn}`,
          customer_alert_ar: orderIdLineAr,
          customer_alert_en: orderIdLineEn,
          rider_delivery_flow_ar: orderIdLineAr,
          rider_delivery_flow_en: orderIdLineEn,
        };
      }
    case "cyclist-broadcast-alert":
      return {
        order_id: resolvedOrderId,
        event_type: "ORDER_READY",
        vendor_name: context.vendorName,
        pickup_location: context.pickupLocation,
        delivery_fee: context.deliveryFee,
        cyclist_phones: context.cyclistPhones,
        no_cyclists_in_zone: context.cyclistPhones.length === 0,
      };
  }
}

async function postWorkflowWebhook(workflow: WorkflowName, payload: Record<string, unknown>, orderId: string) {
  const webhookUrl = `${WORKFLOW_WEBHOOK_BASE_URL}/${workflow}`;
  const sharedSecret = process.env.N8N_WEBHOOK_SECRET;
  let lastError: unknown = null;

  const persistExecutionLog = async (input: {
    status: "success" | "failed";
    attempt: number;
    startedAt: Date;
    completedAt: Date;
    responseStatus?: number | null;
    errorMessage?: string | null;
  }) => {
    const durationMs = Math.max(0, input.completedAt.getTime() - input.startedAt.getTime());
    const { error } = await (supabaseAdmin as any).from("webhook_execution_logs").insert({
      order_id: orderId,
      workflow_name: workflow,
      event_type: String(payload.event_type ?? payload.eventType ?? workflow),
      execution_status: input.status,
      started_at: input.startedAt.toISOString(),
      completed_at: input.completedAt.toISOString(),
      duration_ms: durationMs,
      attempt: input.attempt,
      response_status: input.responseStatus ?? null,
      error_message: input.errorMessage ?? null,
      payload,
    });

    if (error) {
      console.error("Failed to persist webhook execution log", {
        workflow,
        orderId,
        attempt: input.attempt,
        message: error.message,
      });
    }
  };

  for (let attempt = 1; attempt <= WORKFLOW_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 8000);
    const startedAt = new Date();

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sharedSecret ? { "x-webhook-secret": sharedSecret } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        await persistExecutionLog({
          status: "failed",
          attempt,
          startedAt,
          completedAt: new Date(),
          responseStatus: response.status,
          errorMessage: `Webhook ${workflow} responded ${response.status}: ${body}`,
        });
        throw new Error(`Webhook ${workflow} responded ${response.status}: ${body}`);
      }

      await persistExecutionLog({
        status: "success",
        attempt,
        startedAt,
        completedAt: new Date(),
        responseStatus: response.status,
      });

      console.info("Workflow webhook dispatched", {
        workflow,
        orderId,
        status: response.status,
        attempt,
      });
      return;
    } catch (error) {
      clearTimeout(timeoutHandle);
      lastError = error;
      await persistExecutionLog({
        status: "failed",
        attempt,
        startedAt,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      console.error("Workflow webhook dispatch attempt failed", {
        workflow,
        orderId,
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });

      if (attempt < WORKFLOW_MAX_RETRIES) {
        await delay(250 * attempt);
      }
    }
  }

  throw new Error(
    `Failed to dispatch ${workflow} for order ${orderId}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function loadOrderWebhookContext(orderId: string): Promise<OrderWebhookContext | null> {
  const { data: order, error: orderError } = await (supabaseAdmin as any)
    .from("orders")
    .select(
      "id, customer_name, customer_phone, total_price, delivery_fee, payment_method, vendor_id, cyclist_id, neighborhood_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw new Error(orderError.message);
  }

  if (!order?.id) {
    return null;
  }

  const vendorId = typeof order.vendor_id === "string" ? order.vendor_id : null;
  const cyclistId = typeof order.cyclist_id === "string" ? order.cyclist_id : null;
  const neighborhoodId = typeof order.neighborhood_id === "string" ? order.neighborhood_id : null;

  const [vendorRes, cyclistRes, locationRes, coverageRes] = await Promise.all([
    vendorId
      ? (supabaseAdmin as any).from("vendors").select("store_name").eq("id", vendorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    cyclistId
      ? (supabaseAdmin as any).from("cyclists").select("full_name").eq("id", cyclistId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    neighborhoodId
      ? (supabaseAdmin as any)
          .from("neighborhoods")
          .select("name_en, name_fr, name_ar, commune_id")
          .eq("id", neighborhoodId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    neighborhoodId
      ? (supabaseAdmin as any)
          .from("cyclist_coverage")
          .select("cyclists(phone_number, is_active)")
          .eq("neighborhood_id", neighborhoodId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (vendorRes.error) throw new Error(vendorRes.error.message);
  if (cyclistRes.error) throw new Error(cyclistRes.error.message);
  if (locationRes.error) throw new Error(locationRes.error.message);
  if (coverageRes.error) throw new Error(coverageRes.error.message);

  const communeId =
    locationRes.data && typeof locationRes.data === "object" && "commune_id" in locationRes.data
      ? String((locationRes.data as { commune_id?: unknown }).commune_id ?? "").trim() || null
      : null;

  const communeRes = communeId
    ? await (supabaseAdmin as any)
        .from("communes")
        .select("name_en, name_fr, name_ar")
        .eq("id", communeId)
        .maybeSingle()
    : { data: null, error: null };

  if (communeRes.error) throw new Error(communeRes.error.message);

  const coverage = (coverageRes.data ?? []) as Array<{ cyclists?: { phone_number?: string | null; is_active?: boolean | null } | null }>;
  const cyclistPhones = Array.from(
    new Set(
      coverage
        .map((row) => row.cyclists)
        .filter((cyclist): cyclist is { phone_number?: string | null; is_active?: boolean | null } => Boolean(cyclist))
        .filter((cyclist) => cyclist.is_active !== false)
        .map((cyclist) => String(cyclist.phone_number ?? "").trim())
        .filter((phone) => phone.length > 0),
    ),
  );

  const neighborhoodName =
    locationRes.data && typeof locationRes.data === "object"
      ? String(
          (locationRes.data as { name_ar?: unknown; name_fr?: unknown; name_en?: unknown }).name_ar ??
            (locationRes.data as { name_ar?: unknown; name_fr?: unknown; name_en?: unknown }).name_fr ??
            (locationRes.data as { name_ar?: unknown; name_fr?: unknown; name_en?: unknown }).name_en ??
            "",
        ).trim()
      : "";
  const communeName = String(
    (communeRes.data as { name_ar?: unknown; name_fr?: unknown; name_en?: unknown } | null)?.name_ar ??
      (communeRes.data as { name_ar?: unknown; name_fr?: unknown; name_en?: unknown } | null)?.name_fr ??
      (communeRes.data as { name_ar?: unknown; name_fr?: unknown; name_en?: unknown } | null)?.name_en ??
      "",
  ).trim();

  const vendorName = String((vendorRes.data as { store_name?: unknown } | null)?.store_name ?? "").trim();

  return {
    id: String(order.id),
    customerName: String(order.customer_name ?? "").trim(),
    customerPhone: String(order.customer_phone ?? "").trim(),
    total: Number(order.total_price ?? 0) + Number(order.delivery_fee ?? 0),
    deliveryFee: Number(order.delivery_fee ?? 0),
    paymentMethod: typeof order.payment_method === "string" ? order.payment_method : null,
    vendorName,
    cyclistName: String((cyclistRes.data as { full_name?: unknown } | null)?.full_name ?? "").trim(),
    pickupLocation: neighborhoodName || communeName || vendorName,
    cyclistPhones,
    neighborhoodId,
  };
}

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
  const orderIdLineAr = buildOrderIdLine(input.orderId, "ar");
  const orderIdLineEn = buildOrderIdLine(input.orderId, "en");

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
          body: `السائق استلم طلبك وهو الآن في الطريق إليك.\n${orderIdLineAr}`,
          body_en: `Your rider picked up the order and is on the way.\n${orderIdLineEn}`,
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
    triggeredWorkflows: 0,
  };

  const pushEnabled = ensureVapidConfig();

  const events = await claimPendingOrderPushEvents(limit);
  summary.claimed = events.length;

  for (const event of events) {
    try {
      const resolvedOrderId = sanitizeOrderId(event.order_id);
      const template = mapOrderEventTemplate({
        eventType: event.event_type,
        orderId: resolvedOrderId,
        statusAfter: event.status_after,
      });

      const workflowName = getWorkflowFromOrderEvent(event.event_type);
      if (workflowName) {
        const workflowContext = await loadOrderWebhookContext(event.order_id);
        if (workflowContext) {
          const workflowPayload = buildWorkflowPayload(workflowName, workflowContext);
          await postWorkflowWebhook(workflowName, workflowPayload, resolvedOrderId);
          summary.triggeredWorkflows += 1;
        }
      }

      if (pushEnabled && event.customer_user_id && template.customer) {
        const customerResult = await sendPushToUser("customer", event.customer_user_id, {
          title: template.customer.title,
          body: template.customer.body,
          role: "customer",
          url: template.customer.url,
          orderId: resolvedOrderId,
          locationLabel: event.neighborhood_id ?? undefined,
          eventType: template.customer.eventType,
          tag: `order-${resolvedOrderId}-${template.customer.eventType}`,
        });

        summary.sentToCustomers += customerResult.sent;
      }

      if (pushEnabled && event.neighborhood_id && template.cyclist) {
        const cyclistResult = await sendPushToCyclistsByNeighborhood(event.neighborhood_id, {
          title: template.cyclist.title,
          body: template.cyclist.body,
          role: "cyclist",
          url: template.cyclist.url,
          orderId: resolvedOrderId,
          locationLabel: event.neighborhood_id,
          eventType: template.cyclist.eventType,
          tag: `order-${resolvedOrderId}-${template.cyclist.eventType}`,
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
