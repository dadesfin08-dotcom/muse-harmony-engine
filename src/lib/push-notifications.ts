export type PushRole = "customer" | "cyclist";

export type PushClientConfig = {
  enabled: boolean;
  vapidPublicKey: string | null;
  serviceWorkerPath: string;
};

export type PushRegistrationInput = {
  role: PushRole;
  userId: string;
  locationLabel?: string | null;
};

export function isPushSupported() {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIosStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; ++index) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export async function ensurePushPermission() {
  if (!isPushSupported()) return "unsupported" as const;

  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;

  const permission = await Notification.requestPermission();
  return permission;
}