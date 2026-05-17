import { beforeEach, describe, expect, it } from "vitest";

import { useCustomerCartStore } from "@/lib/customer-cart-store";

describe("useCustomerCartStore flash pricing behavior", () => {
  beforeEach(() => {
    useCustomerCartStore.setState({ items: [], isCartOpen: false });
  });

  it("updates existing cart item price when re-adding with active flash price", () => {
    const { addItem } = useCustomerCartStore.getState();

    addItem({
      id: "product-1",
      name: "Product",
      price: 115.34,
      basePrice: 115.34,
      measurementUnit: "Piece",
      image: "img",
      alt: "Product",
    });

    addItem({
      id: "product-1",
      name: "Product",
      price: 92.5,
      basePrice: 115.34,
      measurementUnit: "Piece",
      image: "img",
      alt: "Product",
    });

    const item = useCustomerCartStore.getState().items[0];
    expect(item?.quantity).toBe(2);
    expect(item?.price).toBe(92.5);
    expect(item?.basePrice).toBe(115.34);
  });

  it("keeps flash price while increasing/decreasing quantity", () => {
    const { addItem, increaseItem, decreaseItem } = useCustomerCartStore.getState();

    addItem({
      id: "product-2",
      name: "Deal Product",
      price: 79.99,
      basePrice: 99.99,
      measurementUnit: "Piece",
      image: "img",
      alt: "Deal Product",
    });

    increaseItem("product-2");
    decreaseItem("product-2");

    const item = useCustomerCartStore.getState().items[0];
    expect(item?.quantity).toBe(1);
    expect(item?.price).toBe(79.99);
    expect(item?.basePrice).toBe(99.99);
  });
});