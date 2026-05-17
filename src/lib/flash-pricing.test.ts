import { describe, expect, it } from "vitest";

import { resolveProductDetailPricing } from "@/lib/flash-pricing";

describe("resolveProductDetailPricing", () => {
  it("uses flash sale price when flash deal is active", () => {
    const result = resolveProductDetailPricing({
      isFlashSaleActive: true,
      vendorPrice: 100,
      finalVendorPrice: 115.34,
      flashSalePrice: 80,
      finalFlashSalePrice: 92.5,
    });

    expect(result.useFlash).toBe(true);
    expect(result.effectivePrice).toBe(92.5);
    expect(result.oldPrice).toBe(115.34);
  });

  it("falls back to flashSalePrice when finalFlashSalePrice is missing", () => {
    const result = resolveProductDetailPricing({
      isFlashSaleActive: true,
      vendorPrice: 90,
      finalVendorPrice: 99,
      flashSalePrice: 75.4,
      finalFlashSalePrice: null,
    });

    expect(result.useFlash).toBe(true);
    expect(result.effectivePrice).toBe(75.4);
    expect(result.oldPrice).toBe(99);
  });

  it("uses normal price when flash deal is not active", () => {
    const result = resolveProductDetailPricing({
      isFlashSaleActive: false,
      vendorPrice: 70,
      finalVendorPrice: 81.2,
      flashSalePrice: 60,
      finalFlashSalePrice: 65,
    });

    expect(result.useFlash).toBe(false);
    expect(result.effectivePrice).toBe(81.2);
    expect(result.oldPrice).toBe(81.2);
  });
});