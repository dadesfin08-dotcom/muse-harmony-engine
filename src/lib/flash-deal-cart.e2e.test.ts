import { beforeEach, describe, expect, it } from "vitest";

import { useCustomerCartStore } from "@/lib/customer-cart-store";
import { resolveProductDetailPricing } from "@/lib/flash-pricing";

describe("flash deal pricing end-to-end (product detail -> cart -> quantity updates)", () => {
  beforeEach(() => {
    useCustomerCartStore.setState({ items: [], isCartOpen: false });
  });

  it("keeps flash unit price and subtotal after add to cart then quantity changes", () => {
    const pricing = resolveProductDetailPricing({
      isFlashSaleActive: true,
      vendorPrice: 100,
      finalVendorPrice: 115.34,
      flashSalePrice: 80,
      finalFlashSalePrice: 92.5,
    });

    expect(pricing.useFlash).toBe(true);
    expect(pricing.effectivePrice).toBe(92.5);

    const { addItem, increaseItem, decreaseItem } = useCustomerCartStore.getState();

    addItem({
      id: "flash-product-1",
      cartItemId: "flash-product-1",
      productId: "flash-product-1",
      name: "Flash Product",
      price: pricing.effectivePrice,
      basePrice: pricing.oldPrice,
      measurementUnit: "Piece",
      image: "img",
      alt: "Flash Product",
    });

    increaseItem("flash-product-1");
    increaseItem("flash-product-1");

    let item = useCustomerCartStore.getState().items[0];
    expect(item?.quantity).toBe(3);
    expect(item?.price).toBe(92.5);
    expect(item?.basePrice).toBe(115.34);
    expect((item?.price ?? 0) * (item?.quantity ?? 0)).toBe(277.5);

    decreaseItem("flash-product-1");

    item = useCustomerCartStore.getState().items[0];
    expect(item?.quantity).toBe(2);
    expect(item?.price).toBe(92.5);
    expect((item?.price ?? 0) * (item?.quantity ?? 0)).toBe(185);
  });
});