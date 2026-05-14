export const QR_SETTLEMENT_ALLOWED_STATUS = "delivered_cash_with_cyclist" as const;
export const QR_SETTLEMENT_ALLOWED_PAYMENT_METHOD = "COD" as const;
export const QR_SETTLEMENT_ALLOWED_VENDOR_SETTLEMENT_STATUS = "pending" as const;

export const VENDOR_KPI_PENDING_STATUS = "delivered_cash_with_cyclist" as const;
export const VENDOR_KPI_SETTLED_STATUS = "cash_transferred_to_vendor" as const;

export const ADMIN_RECONCILIATION_ALLOWED_STATUS = "cash_transferred_to_vendor" as const;

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function isCodPaymentMethod(paymentMethod: string | null | undefined) {
  const normalized = normalize(paymentMethod);
  return normalized === "cod" || normalized === "cash";
}

export function isVendorKpiPendingStatus(status: string | null | undefined) {
  return normalize(status) === VENDOR_KPI_PENDING_STATUS;
}

export function isVendorKpiSettledStatus(status: string | null | undefined) {
  return normalize(status) === VENDOR_KPI_SETTLED_STATUS;
}

export function isAdminReconciliationAllowedStatus(status: string | null | undefined) {
  return normalize(status) === ADMIN_RECONCILIATION_ALLOWED_STATUS;
}

export function isOrderEligibleForQrSettlement(row: {
  vendor_id?: string | null;
  cyclist_id?: string | null;
  payment_method?: string | null;
  status?: string | null;
  vendor_settlement_status?: string | null;
}, context: { vendorId: string; cyclistId: string }) {
  return (
    row.vendor_id === context.vendorId &&
    row.cyclist_id === context.cyclistId &&
    normalize(row.payment_method) === QR_SETTLEMENT_ALLOWED_PAYMENT_METHOD.toLowerCase() &&
    normalize(row.status) === QR_SETTLEMENT_ALLOWED_STATUS &&
    normalize(row.vendor_settlement_status) === QR_SETTLEMENT_ALLOWED_VENDOR_SETTLEMENT_STATUS
  );
}