import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  getPushClientConfig,
  processOrderPushQueue,
  registerPushSubscription,
} from "@/lib/push-notifications.functions";
import {
  ensurePushPermission,
  isPushSupported,
  urlBase64ToUint8Array,
  type PushRole,
} from "@/lib/push-notifications";

type UsePushNotificationsOptions = {
  enabled: boolean;
  role: PushRole;
  userId: string | null;
  locationLabel?: string | null;
};

function normalizeRole(value: unknown): PushRole {
  const raw = String(value ?? "").toLowerCase();
  return raw === "cyclist" || raw === "rider" ? "cyclist" : "customer";
}

function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function usePushNotifications(options: UsePushNotificationsOptions) {
  const fetchPushConfig = useServerFn(getPushClientConfig);
  const registerSubscriptionFn = useServerFn(registerPushSubscription);
  const processQueueFn = useServerFn(processOrderPushQueue);

  const canAttemptRegistration = useMemo(
    () => options.enabled && !!options.userId && isPushSupported(),
    [options.enabled, options.userId],
  );

  useEffect(() => {
    if (!canAttemptRegistration || !options.userId) return;

    let cancelled = false;

    const register = async () => {
      try {
        const config = await fetchPushConfig();
        if (!config.enabled || !config.vapidPublicKey) return;

        const vapidStorageKey = "push_vapid_public_key";
        const previousVapidKey = window.localStorage.getItem(vapidStorageKey);
        const vapidKeyChanged = !!previousVapidKey && previousVapidKey !== config.vapidPublicKey;

        const permission = await ensurePushPermission();
        if (permission !== "granted") return;

        const registration = await navigator.serviceWorker.register(config.serviceWorkerPath);
        const expectedServerKey = urlBase64ToUint8Array(config.vapidPublicKey);

        let subscription = await registration.pushManager.getSubscription();
        if (subscription && vapidKeyChanged) {
          await subscription.unsubscribe();
          subscription = null;
        }

        if (subscription?.options?.applicationServerKey) {
          const currentServerKey = new Uint8Array(subscription.options.applicationServerKey);
          const sameVapidKey = areUint8ArraysEqual(currentServerKey, expectedServerKey);

          if (!sameVapidKey) {
            await subscription.unsubscribe();
            subscription = null;
          }
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedServerKey,
          });
        }

        if (cancelled) return;

        const json = subscription.toJSON();
        const endpoint = json.endpoint;
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;

        if (!endpoint || !p256dh || !auth) return;

        await registerSubscriptionFn({
          data: {
            userId: options.userId,
            role: options.role,
            endpoint,
            p256dh,
            auth,
            locationLabel: options.locationLabel ?? null,
          },
        });

        window.localStorage.setItem(vapidStorageKey, config.vapidPublicKey);
      } catch (error) {
        console.error("Push registration failed:", error);
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, [
    canAttemptRegistration,
    fetchPushConfig,
    options.locationLabel,
    options.role,
    options.userId,
    registerSubscriptionFn,
  ]);

  useEffect(() => {
    if (!canAttemptRegistration) return;

    const intervalId = window.setInterval(() => {
      void processQueueFn({ data: { limit: 20 } }).catch((error) => {
        console.error("Order push queue processing failed:", error);
      });
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [canAttemptRegistration, processQueueFn]);

  useEffect(() => {
    if (!canAttemptRegistration) return;

    const showToast = (payload: any) => {
      if (!payload?.title) return;

      const payloadRole = normalizeRole(payload.role ?? options.role);

      if (payloadRole === "cyclist") {
        toast(payload.title, {
          description: payload.body,
          className:
            "fixed top-[max(env(safe-area-inset-top),0.5rem)] right-2 left-auto md:max-w-[420px] bg-emerald-600 text-white border-none shadow-2xl",
          duration: 10000,
        });
        return;
      }

      toast(payload.title, {
        description: payload.body,
        duration: 8000,
      });
    };

    const handleMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type !== "PUSH_NOTIFICATION_CLICK" && type !== "PUSH_RECEIVED") return;
      showToast((event.data as { payload?: any } | null)?.payload);
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [canAttemptRegistration, options.role]);
}
