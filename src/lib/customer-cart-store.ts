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
  increaseItem: (productId: string) => void;
  decreaseItem: (productId: string) => void;
  removeItem: (productId: string) => void;
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
      increaseItem: (productId) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        })),
      decreaseItem: (productId) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              item.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
            )
            .filter((item) => item.quantity > 0),
        })),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== productId),
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
