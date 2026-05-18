import { create } from "zustand";

export type CustomerPanelView = "account" | "profile" | "orders" | "carnet" | "support";

export type CustomerSupportContext = {
  orderId?: string | null;
  pickupCode?: string | null;
  source?: "home" | "order-details" | "active-order" | "delivery" | "manual";
};

type CustomerPanelState = {
  isCustomerAuthModalOpen: boolean;
  customerPanelView: CustomerPanelView;
  supportContext: CustomerSupportContext | null;
  setIsCustomerAuthModalOpen: (open: boolean) => void;
  setCustomerPanelView: (view: CustomerPanelView) => void;
  setSupportContext: (context: CustomerSupportContext | null) => void;
  openSupportPanel: (context?: CustomerSupportContext | null) => void;
  clearSupportContext: () => void;
  openCustomerPanel: (view?: CustomerPanelView) => void;
};

export const useCustomerPanelStore = create<CustomerPanelState>((set) => ({
  isCustomerAuthModalOpen: false,
  customerPanelView: "account",
  supportContext: null,
  setIsCustomerAuthModalOpen: (open) => set({ isCustomerAuthModalOpen: open }),
  setCustomerPanelView: (view) => set({ customerPanelView: view }),
  setSupportContext: (context) => set({ supportContext: context }),
  openSupportPanel: (context = null) =>
    set({
      customerPanelView: "support",
      supportContext: context,
      isCustomerAuthModalOpen: true,
    }),
  clearSupportContext: () => set({ supportContext: null }),
  openCustomerPanel: (view = "account") =>
    set({
      customerPanelView: view,
      isCustomerAuthModalOpen: true,
    }),
}));