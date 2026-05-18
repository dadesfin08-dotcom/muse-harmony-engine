import { describe, expect, it } from "vitest";

import { getLatestOutForDeliveryOrderId } from "@/lib/customer-delivery-shortcut";

const baseOrder = {
  created_at: "2026-05-18T10:00:00.000Z",
};

describe("getLatestOutForDeliveryOrderId", () => {
  it("returns latest active order id for out_for_delivery status variants", () => {
    const cases = [
      "out_for_delivery",
      "Out For Delivery",
      "OUT-FOR-DELIVERY",
      "outfordelivery",
      "in_delivery",
      "in transit",
      "delivering",
      "on the way",
      "picked_up",
    ];

    for (const status of cases) {
      const result = getLatestOutForDeliveryOrderId([
        { ...baseOrder, id: "older", status: "pending", created_at: "2026-05-17T10:00:00.000Z" },
        { ...baseOrder, id: `active-${status}`, status, created_at: "2026-05-18T11:00:00.000Z" },
      ]);

      expect(result).toBe(`active-${status}`);
    }
  });

  it("uses delivery_status, deliveryStatus, and order_status fields for detection", () => {
    expect(
      getLatestOutForDeliveryOrderId([
        { ...baseOrder, id: "a1", delivery_status: "out_for_delivery" },
      ]),
    ).toBe("a1");

    expect(
      getLatestOutForDeliveryOrderId([
        { ...baseOrder, id: "a2", deliveryStatus: "out_for_delivery" },
      ]),
    ).toBe("a2");

    expect(
      getLatestOutForDeliveryOrderId([
        { ...baseOrder, id: "a3", order_status: "out_for_delivery" },
      ]),
    ).toBe("a3");
  });

  it("hides red-dot shortcut when latest active order is completed/delivered", () => {
    const result = getLatestOutForDeliveryOrderId([
      { ...baseOrder, id: "active", status: "out_for_delivery", created_at: "2026-05-18T10:00:00.000Z" },
      { ...baseOrder, id: "done", status: "completed", created_at: "2026-05-18T11:00:00.000Z" },
    ]);

    expect(result).toBeNull();
  });

  it("returns null when there are no valid active out_for_delivery orders", () => {
    expect(getLatestOutForDeliveryOrderId([])).toBeNull();
    expect(
      getLatestOutForDeliveryOrderId([
        { ...baseOrder, id: "1", status: "pending" },
        { ...baseOrder, id: "2", status: "delivered" },
      ]),
    ).toBeNull();
  });
});