import { describe, expect, it } from "vitest";

import {
  isAdminReconciliationAllowedStatus,
  isCodPaymentMethod,
  isOrderEligibleForQrSettlement,
  isVendorKpiPendingStatus,
  isVendorKpiSettledStatus,
} from "@/lib/settlement-status-rules";

describe("Vendor KPI status rules", () => {
  it("includes only delivered_cash_with_cyclist in pending KPI bucket", () => {
    const rows = [
      { status: "delivered_cash_with_cyclist", payment_method: "COD", total_price: 12 },
      { status: "cash_transferred_to_vendor", payment_method: "COD", total_price: 50 },
      { status: "delivered", payment_method: "COD", total_price: 30 },
      { status: "delivered_cash_with_cyclist", payment_method: "Carnet", total_price: 20 },
    ];

    const pendingCash = rows
      .filter((row) => isVendorKpiPendingStatus(row.status))
      .filter((row) => isCodPaymentMethod(row.payment_method))
      .reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);

    expect(pendingCash).toBe(12);
  });

  it("includes only cash_transferred_to_vendor in settled KPI bucket", () => {
    const statuses = ["cash_transferred_to_vendor", "delivered", "delivered_cash_with_cyclist", "cancelled"];
    const inScope = statuses.filter((status) => isVendorKpiSettledStatus(status));
    expect(inScope).toEqual(["cash_transferred_to_vendor"]);
  });
});

describe("Super-Admin reconciliation status rules", () => {
  it("aggregates only cash_transferred_to_vendor orders", () => {
    const rows = [
      { status: "cash_transferred_to_vendor", total_price: 40 },
      { status: "delivered_cash_with_cyclist", total_price: 15 },
      { status: "delivered", total_price: 99 },
    ];

    const revenue = rows.reduce((sum, row) => {
      return isAdminReconciliationAllowedStatus(row.status) ? sum + Number(row.total_price ?? 0) : sum;
    }, 0);

    expect(revenue).toBe(40);
  });
});

describe("QR settlement eligibility rules", () => {
  const context = { vendorId: "vendor-1", cyclistId: "cyclist-1" };

  it("accepts only rows matching vendor/cyclist/payment_method/status/settlement_status", () => {
    const eligible = isOrderEligibleForQrSettlement(
      {
        vendor_id: "vendor-1",
        cyclist_id: "cyclist-1",
        payment_method: "COD",
        status: "delivered_cash_with_cyclist",
        vendor_settlement_status: "pending",
      },
      context,
    );

    expect(eligible).toBe(true);
  });

  it("rejects rows with any mismatched field", () => {
    const rows = [
      { vendor_id: "vendor-2", cyclist_id: "cyclist-1", payment_method: "COD", status: "delivered_cash_with_cyclist", vendor_settlement_status: "pending" },
      { vendor_id: "vendor-1", cyclist_id: "cyclist-2", payment_method: "COD", status: "delivered_cash_with_cyclist", vendor_settlement_status: "pending" },
      { vendor_id: "vendor-1", cyclist_id: "cyclist-1", payment_method: "Carnet", status: "delivered_cash_with_cyclist", vendor_settlement_status: "pending" },
      { vendor_id: "vendor-1", cyclist_id: "cyclist-1", payment_method: "COD", status: "delivered", vendor_settlement_status: "pending" },
      { vendor_id: "vendor-1", cyclist_id: "cyclist-1", payment_method: "COD", status: "delivered_cash_with_cyclist", vendor_settlement_status: "settled" },
    ];

    const result = rows.map((row) => isOrderEligibleForQrSettlement(row, context));
    expect(result).toEqual([false, false, false, false, false]);
  });
});