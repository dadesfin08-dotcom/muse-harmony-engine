import { describe, expect, it } from "vitest";

import { extractDeliveryCode } from "@/lib/extract-delivery-code";

describe("extractDeliveryCode", () => {
  const orderId = "order-123";

  it("accepts raw numeric PIN values", () => {
    expect(extractDeliveryCode("1234", orderId)).toBe("1234");
    expect(extractDeliveryCode(" 123456 ", orderId)).toBe("123456");
  });

  it("accepts inline legacy text formats", () => {
    expect(extractDeliveryCode("PIN: 4321", orderId)).toBe("4321");
    expect(extractDeliveryCode("code-98765", orderId)).toBe("98765");
  });

  it("supports old QR JSON formats", () => {
    expect(extractDeliveryCode('{"orderId":"order-123","code":"2468"}', orderId)).toBe("2468");
    expect(extractDeliveryCode('{"order_id":"order-123","pin":"1357"}', orderId)).toBe("1357");
  });

  it("supports new QR JSON formats", () => {
    expect(extractDeliveryCode('{"orderId":"order-123","deliveryAuthCode":"1122"}', orderId)).toBe("1122");
    expect(extractDeliveryCode('{"order_id":"order-123","delivery_auth_code":"3344"}', orderId)).toBe("3344");
  });

  it("rejects payloads with mismatched order id", () => {
    expect(extractDeliveryCode('{"orderId":"different-order","code":"2468"}', orderId)).toBeNull();
    expect(extractDeliveryCode('{"order_id":"different-order","delivery_auth_code":"3344"}', orderId)).toBeNull();
  });

  it("rejects invalid or malformed values", () => {
    expect(extractDeliveryCode("12", orderId)).toBeNull();
    expect(extractDeliveryCode("abcd", orderId)).toBeNull();
    expect(extractDeliveryCode('{"orderId":"order-123","code":"12ab"}', orderId)).toBeNull();
    expect(extractDeliveryCode('{"orderId":"order-123","pin":"1234567"}', orderId)).toBeNull();
    expect(extractDeliveryCode("{broken-json}", orderId)).toBeNull();
  });
});
