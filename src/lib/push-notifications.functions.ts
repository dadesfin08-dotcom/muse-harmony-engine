import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getPushPublicConfig,
  processPendingOrderPushEvents,
  removePushSubscription,
  upsertPushSubscription,
  type PushRole,
} from "@/lib/push-notifications.server";

const roleSchema = z.enum(["customer", "cyclist"]);

const registerSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
  endpoint: z.string().url().max(4096),
  p256dh: z.string().min(1).max(1024),
  auth: z.string().min(1).max(1024),
  locationLabel: z.string().trim().max(180).optional().nullable(),
});

const unregisterSchema = z.object({
  userId: z.string().uuid(),
  role: roleSchema,
  endpoint: z.string().url().max(4096).optional(),
});

const processQueueSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export const getPushClientConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { vapidPublicKey, serviceWorkerPath } = getPushPublicConfig();
  return {
    enabled: Boolean(vapidPublicKey),
    vapidPublicKey,
    serviceWorkerPath,
  };
});

export const registerPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    await upsertPushSubscription({
      userId: data.userId,
      role: data.role as PushRole,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      locationLabel: data.locationLabel ?? null,
    });

    return { ok: true };
  });

export const unregisterPushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input) => unregisterSchema.parse(input))
  .handler(async ({ data }) => {
    await removePushSubscription({
      userId: data.userId,
      role: data.role as PushRole,
      endpoint: data.endpoint,
    });

    return { ok: true };
  });

export const processOrderPushQueue = createServerFn({ method: "POST" })
  .inputValidator((input) => processQueueSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    return processPendingOrderPushEvents(data.limit ?? 25);
  });
