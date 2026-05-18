export type CustomerOrderStatusCandidate = {
  id?: string | null;
  status?: string | null;
  delivery_status?: string | null;
  deliveryStatus?: string | null;
  order_status?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

const outForDeliveryStatuses = new Set([
  "out_for_delivery",
  "outfordelivery",
  "in_delivery",
  "in_transit",
  "delivering",
  "on_the_way",
  "picked_up",
]);

const terminalStatuses = new Set([
  "delivered",
  "delivered_cash_with_cyclist",
  "cash_transferred_to_vendor",
  "completed",
  "cancelled",
  "canceled",
  "rejected",
  "failed",
  "refunded",
  "expired",
]);

export const normalizeOrderStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");

const getOrderStatus = (order: CustomerOrderStatusCandidate) =>
  order.delivery_status ?? order.deliveryStatus ?? order.order_status ?? order.status ?? "";

export const getLatestOutForDeliveryOrderId = (orders: CustomerOrderStatusCandidate[] | null | undefined) => {
  const latestOrder = (orders ?? [])
    .filter((order) => {
      const orderId = String(order.id ?? "").trim();
      return !!orderId;
    })
    .sort((a, b) => {
      const aTime = new Date(a.created_at ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.created_at ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    })[0];

  if (!latestOrder) return null;

  const normalizedLatestStatus = normalizeOrderStatus(getOrderStatus(latestOrder));
  if (terminalStatuses.has(normalizedLatestStatus)) return null;

  return outForDeliveryStatuses.has(normalizedLatestStatus)
    ? String(latestOrder.id ?? "").trim() || null
    : null;
};