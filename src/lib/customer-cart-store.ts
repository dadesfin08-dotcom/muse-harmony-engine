import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CustomerCartItem = {
  id: string;
  cartItemId?: string;
  productId?: string;
  vendorId?: string;
  name: string;
  brandName?: string | null;
  measurementValue?: number | null;
  price: number;
  basePrice?: number;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  selectedVariant?: string | null;
  image: string;
  alt: string;
  quantity: number;
};

type AddCartInput = Omit<CustomerCartItem, "quantity">;

type CustomerCartState = {
  items: CustomerCartItem[];
  isCartOpen: boolean;
  addItem: (item: AddCartInput) => void;
  increaseItem: (cartItemId: string) => void;
  decreaseItem: (cartItemId: string) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
};

export const useCustomerCartStore = create<CustomerCartState>()(
  persist(
    (set) => ({
      items: [],
      isCartOpen: false,
      addItem: (item) =>
        set((state) => {
          const itemKey = item.cartItemId || item.id;
          const existingItem = state.items.find((cartItem) => (cartItem.cartItemId || cartItem.id) === itemKey);

          if (existingItem) {
            return {
              items: state.items.map((cartItem) =>
                (cartItem.cartItemId || cartItem.id) === itemKey
                  ? {
                      ...cartItem,
                      ...item,
                      quantity: cartItem.quantity + 1,
                    }
                  : cartItem,
              ),
            };
          }

          return {
            items: [...state.items, { ...item, quantity: 1 }],
          };
        }),
      increaseItem: (cartItemId) =>
        set((state) => ({
          items: state.items.map((item) =>
            (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        })),
      decreaseItem: (cartItemId) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              (item.cartItemId || item.id) === cartItemId ? { ...item, quantity: item.quantity - 1 } : item,
            )
            .filter((item) => item.quantity > 0),
        })),
      removeItem: (cartItemId) =>
        set((state) => ({
          items: state.items.filter((item) => (item.cartItemId || item.id) !== cartItemId),
        })),
      clearCart: () => set({ items: [] }),
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),
    }),
    {
      name: "bzaf-customer-cart",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
