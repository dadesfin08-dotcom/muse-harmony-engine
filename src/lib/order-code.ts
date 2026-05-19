export function toPublicOrderCode(orderId: string | null | undefined) {
  const normalized = String(orderId ?? "").trim();
  if (!normalized) return "#UNKNOWN";

  const compact = normalized.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const shortCode = compact.slice(-4);
  return `#${shortCode || "UNKNOWN"}`;
}

export function toOrderCodeLine(orderId: string | null | undefined, locale: "ar" | "en") {
  const code = toPublicOrderCode(orderId);
  return locale === "ar" ? `رقم الطلب: ${code}` : `Order ID: ${code}`;
}