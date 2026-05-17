self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizeRole(value) {
  const raw = String(value || "").toLowerCase();
  return raw === "cyclist" || raw === "rider" ? "cyclist" : "customer";
}

function buildFallbackPayload() {
  return {
    title: "تحديث بخصوص طلبك",
    body: "هناك تحديث جديد لحالة الطلب داخل التطبيق.",
    url: "/customer#orders",
    role: "customer",
    tag: `push-${Date.now()}`,
  };
}

self.addEventListener("push", (event) => {
  let incoming = buildFallbackPayload();

  try {
    if (event.data) {
      incoming = { ...incoming, ...event.data.json() };
    }
  } catch {
    incoming = buildFallbackPayload();
  }

  const role = normalizeRole(incoming.role);
  const icon =
    incoming.icon || (role === "cyclist" ? "/icons/push-rider-192.png" : "/icons/push-customer-192.png");
  const badge = incoming.badge || "/icons/badge-72.png";

  const payload = {
    ...incoming,
    role,
    icon,
    badge,
    url: incoming.url || (role === "cyclist" ? "/cyclist/dashboard" : "/customer#orders"),
    tag: incoming.tag || (incoming.orderId ? `order-${incoming.orderId}` : `push-${Date.now()}`),
  };

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    requireInteraction: role === "cyclist",
    data: payload,
    vibrate: role === "cyclist" ? [100, 50, 100] : [80, 40, 80],
  };

  event.waitUntil(
    self.registration
      .showNotification(payload.title || "Notification", options)
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({ type: "PUSH_RECEIVED", payload });
        });
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const payload = event.notification.data || {};
  const targetUrl = payload.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "PUSH_NOTIFICATION_CLICK", payload });
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
