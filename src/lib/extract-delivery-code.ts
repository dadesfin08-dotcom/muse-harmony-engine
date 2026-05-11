export const extractDeliveryCode = (rawValue: string, orderId: string) => {
  const trimmed = rawValue.trim();

  const getValidCode = (value: unknown) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return /^\d{4,6}$/.test(normalized) ? normalized : null;
  };

  if (/^\d{4,6}$/.test(trimmed)) {
    return trimmed;
  }

  const inlinePinMatch = trimmed.match(/(?:PIN|CODE)\s*[:\-]?\s*(\d{4,6})/i);
  if (inlinePinMatch?.[1]) {
    return inlinePinMatch[1];
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      orderId?: string;
      order_id?: string;
      code?: string;
      pin?: string;
      deliveryAuthCode?: string;
      delivery_auth_code?: string;
    };

    const payloadOrderId = parsed.orderId ?? parsed.order_id;
    if (payloadOrderId && payloadOrderId !== orderId) {
      return null;
    }

    return (
      getValidCode(parsed.code) ??
      getValidCode(parsed.pin) ??
      getValidCode(parsed.deliveryAuthCode) ??
      getValidCode(parsed.delivery_auth_code)
    );
  } catch {
    return null;
  }
};
