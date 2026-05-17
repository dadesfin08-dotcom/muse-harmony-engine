self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "New update", body: "You have a new notification." };
  }

  const role = payload.role === "cyclist" ? "cyclist" : "customer";
  const icon = payload.icon || (role === "cyclist" ? "/icons/push-rider-192.png" : "/icons/push-customer-192.png");
  const badge = payload.badge || "/icons/badge-72.png";

  const options = {
    body: payload.body || "",
    icon,
    badge,
    data: {
      url: payload.url || "/",
      role,
      orderId: payload.orderId || null,
      locationLabel: payload.locationLabel || null,
      eventType: payload.eventType || null,
      title: payload.title || "Notification",
      body: payload.body || "",
      icon,
      badge,
    },
    vibrate: role === "cyclist" ? [100, 50, 100] : [80, 40, 80],
    requireInteraction: role === "cyclist",
    renotify: true,
    tag: payload.orderId ? `order-${payload.orderId}` : `push-${Date.now()}`,
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Notification", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({
            type: "PUSH_NOTIFICATION_CLICK",
            payload: event.notification.data || {},
          });
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});