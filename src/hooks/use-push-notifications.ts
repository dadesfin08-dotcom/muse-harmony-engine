import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  getPushClientConfig,
  registerPushSubscription,
} from "@/lib/push-notifications.functions";
import { isPushSupported, urlBase64ToUint8Array, type PushRole } from "@/lib/push-notifications";

type UsePushNotificationsOptions = {
  enabled: boolean;
  role: PushRole;
  userId: string | null;
  locationLabel?: string | null;
};

export function usePushNotifications(options: UsePushNotificationsOptions) {
  const fetchPushConfig = useServerFn(getPushClientConfig);
  const registerSubscriptionFn = useServerFn(registerPushSubscription);

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

        if (Notification.permission !== "granted") return;

        const registration = await navigator.serviceWorker.register(config.serviceWorkerPath);
        const existing = await registration.pushManager.getSubscription();

        const subscription =
          existing ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
          }));

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
          },
        });
      } catch (error) {
        console.error("Push registration failed:", error);
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, [canAttemptRegistration, fetchPushConfig, options.role, options.userId, registerSubscriptionFn]);

  useEffect(() => {
    if (!canAttemptRegistration) return;

    const handleMessage = (event: MessageEvent) => {
      const messageType = (event.data as { type?: string } | null)?.type;
      if (messageType !== "PUSH_NOTIFICATION_CLICK") return;

      const pushData = (event.data as { payload?: any })?.payload;
      if (!pushData?.title) return;

      if (options.role === "cyclist") {
        toast(pushData.title, {
          description: pushData.body,
          className:
            "top-0 right-0 flex fixed md:max-w-[420px] md:top-4 md:right-4 bg-emerald-600 text-white border-none shadow-2xl",
          duration: 10000,
        });
        return;
      }

      toast(pushData.title, {
        description: pushData.body,
        duration: 8000,
      });
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [canAttemptRegistration, options.role]);
}