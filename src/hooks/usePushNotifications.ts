import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type PushUserType = "customer" | "vendor" | "cyclist" | "admin";

type NotificationPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
};

async function resolveVapidPublicKey() {
  const viteKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (viteKey) return viteKey;

  const response = await fetch("/api/public/push-config");
  if (!response.ok) {
    throw new Error("Missing VAPID public key configuration.");
  }

  const data = (await response.json()) as { publicKey?: string };
  if (!data.publicKey) {
    throw new Error("Missing VAPID public key configuration.");
  }

  return data.publicKey;
}

function base64UrlToUint8Array(base64UrlString: string) {
  const padding = "=".repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = (base64UrlString + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function detectIosSafariInstallHint() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return isIos && isSafari && !isStandalone;
}

export function usePushNotifications() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : null,
  );

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const showIosInstallHint = useMemo(() => detectIosSafariInstallHint(), []);
  const isPermissionDenied = permissionState === "denied";

  const deniedPermissionMessage = showIosInstallHint
    ? "Notifications are blocked. On iOS, install the app first (Safari → Share → Add to Home Screen), then enable notifications from app/site settings."
    : "Notifications are blocked. Please enable notifications from browser/site settings and try again.";

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) {
        setIsAuthenticated(Boolean(user));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const syncSubscriptionState = useCallback(async () => {
    if (!isSupported) {
      setIsSubscribed(false);
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration("/");
    const currentSubscription = await registration?.pushManager.getSubscription();
    const next = Boolean(currentSubscription);
    setIsSubscribed(next);
    return next;
  }, [isSupported]);

  const subscribe = useCallback(
    async (user_type: PushUserType) => {
      if (!isSupported) {
        throw new Error("Push notifications are not supported on this device/browser.");
      }

      const vapidPublicKey = await resolveVapidPublicKey();

      setIsLoading(true);
      setError(null);

      try {
        let permission = Notification.permission;
        if (permission === "denied") {
          setPermissionState(permission);
          throw new Error(deniedPermissionMessage);
        }

        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        setPermissionState(permission);

        if (permission !== "granted") {
          throw new Error(deniedPermissionMessage);
        }

        const registration =
          (await navigator.serviceWorker.getRegistration("/")) ||
          (await navigator.serviceWorker.register("/sw-push.js", { scope: "/" }));

        const existingSubscription = await registration.pushManager.getSubscription();
        const subscription =
          existingSubscription ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
          }));

        const subscriptionJson = subscription.toJSON();
        const p256dh = subscriptionJson.keys?.p256dh;
        const auth = subscriptionJson.keys?.auth;

        if (!p256dh || !auth) {
          throw new Error("Invalid push subscription keys.");
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Please sign in first, then try enabling push notifications again.");
        }

        const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: user.id,
            user_type,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          },
          {
            onConflict: "user_id,endpoint",
          },
        );

        if (upsertError) {
          throw upsertError;
        }

        setIsSubscribed(true);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to subscribe for push notifications.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [deniedPermissionMessage, isSupported],
  );

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const endpoint = subscription.endpoint;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await subscription.unsubscribe();

      if (user?.id) {
        await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
      }

      setIsSubscribed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unsubscribe from push notifications.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const sendTestNotification = useCallback(async (payload: NotificationPayload) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Please sign in first, then try again.");
    }

    const response = await fetch("/api/public/send-push-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        payload,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Failed to send push notification.");
    }

    return response.json();
  }, []);

  return {
    isSupported,
    showIosInstallHint,
    isPermissionDenied,
    isAuthenticated,
    isLoading,
    error,
    isSubscribed,
    subscribe,
    unsubscribe,
    syncSubscriptionState,
    sendTestNotification,
  };
}