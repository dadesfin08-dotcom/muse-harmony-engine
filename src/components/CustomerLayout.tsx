import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  House,
  Search,
  ShoppingCart,
  UserCircle2,
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  ClipboardList,
  User,
  Gift,
  BookOpen,
  ShoppingBag,
  BadgeCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomerStatusAlert } from "@/components/CustomerStatusAlert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { getGlobalSettings } from "@/lib/admin-dashboard.functions";
import { getCustomerCarnetBalance, getCustomerCarnetOverview } from "@/lib/carnet.functions";
import { getLatestOutForDeliveryOrderId } from "@/lib/customer-delivery-shortcut";
import { getCustomerOrders } from "@/lib/orders.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import { listServiceZones } from "@/lib/locations.functions";
import { useCustomerPanelStore } from "@/lib/customer-panel-store";

const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";

type CustomerLayoutProps = {
  children: React.ReactNode;
  onSearchClick?: () => void;
  onCheckoutClick?: () => void;
};

export function CustomerLayout({
  children,
  onSearchClick,
  onCheckoutClick,
}: CustomerLayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fetchGlobalSettings = useServerFn(getGlobalSettings);
  const fetchCustomerCarnetBalance = useServerFn(getCustomerCarnetBalance);
  const fetchCustomerCarnetOverview = useServerFn(getCustomerCarnetOverview);
  const fetchCustomerOrders = useServerFn(getCustomerOrders);
  const fetchServiceZones = useServerFn(listServiceZones);
  const cartItems = useCustomerCartStore((state) => state.items);
  const isCartOpen = useCustomerCartStore((state) => state.isCartOpen);
  const openCart = useCustomerCartStore((state) => state.openCart);
  const closeCart = useCustomerCartStore((state) => state.closeCart);
  const increaseItem = useCustomerCartStore((state) => state.increaseItem);
  const decreaseItem = useCustomerCartStore((state) => state.decreaseItem);
  const removeItem = useCustomerCartStore((state) => state.removeItem);
  const isCustomerAuthModalOpen = useCustomerPanelStore((state) => state.isCustomerAuthModalOpen);
  const customerPanelView = useCustomerPanelStore((state) => state.customerPanelView);
  const openCustomerPanel = useCustomerPanelStore((state) => state.openCustomerPanel);
  const [isProfileHubOpen, setIsProfileHubOpen] = useState(false);
  const [isCarnetDialogOpen, setIsCarnetDialogOpen] = useState(false);
  const profileHubTimerRef = useRef<number | null>(null);
  const [customerSessionPhone, setCustomerSessionPhone] = useState<string | null>(null);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(null);

  const globalSettingsQuery = useQuery({
    queryKey: ["customer", "global-settings"],
    queryFn: () => fetchGlobalSettings(),
    staleTime: 30_000,
  });

  const serviceZonesQuery = useQuery({
    queryKey: ["customer", "service-zones"],
    queryFn: () => fetchServiceZones(),
    staleTime: 30_000,
  });

  const customerCarnetBalanceQuery = useQuery({
    queryKey: ["customer", "profile-hub", "carnet-balance", customerSessionPhone],
    queryFn: () =>
      fetchCustomerCarnetBalance({
        data: { customerPhone: customerSessionPhone! },
      }),
    enabled: !!customerSessionPhone,
    staleTime: 10_000,
    refetchInterval: customerSessionPhone ? 8_000 : false,
  });

  const customerCarnetOverviewQuery = useQuery({
    queryKey: ["customer", "profile-hub", "carnet-overview", customerSessionPhone],
    queryFn: () =>
      fetchCustomerCarnetOverview({
        data: { customerPhone: customerSessionPhone! },
      }),
    enabled: isCarnetDialogOpen && !!customerSessionPhone,
    staleTime: 10_000,
  });

  const customerOrdersQuery = useQuery({
    queryKey: ["customer", "orders", customerSessionPhone],
    queryFn: () =>
      fetchCustomerOrders({
        data: { phoneNumber: customerSessionPhone! },
      }),
    enabled: !!customerSessionPhone,
    staleTime: 0,
    refetchInterval: customerSessionPhone ? 4_000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: "always",
    refetchOnMount: "always",
  });

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );
  const language = (i18n.resolvedLanguage || i18n.language || "en") as "ar" | "fr" | "en";
  const cartLabel = useMemo(() => {
    if (language === "ar") {
      return `${cartCount} ${cartCount === 1 ? "منتج" : "منتجات"}`;
    }

    if (language === "fr") {
      return `${cartCount} ${cartCount === 1 ? "article" : "articles"}`;
    }

    return `${cartCount} item${cartCount === 1 ? "" : "s"}`;
  }, [cartCount, language]);
  const isArabic = (i18n.resolvedLanguage || i18n.language || "en") === "ar";
  const layoutCopy = useMemo(() => {
    if (language === "ar") {
      return {
        profileHub: "حسابي",
        myOrders: "طلباتي",
        accountSettings: "إعدادات الحساب",
        myCarnet: "الكارني ديالي",
        debtLabel: "الدَّين",
        cartTitle: "سلّتي",
        cartSubtitle: "منتج في السلة",
        subtotal: "المجموع الفرعي",
        delivery: "التوصيل",
        total: "الإجمالي",
        checkout: "إتمام الطلب",
        carnetDetails: "تفاصيل الكارني",
        unpaidBalance: "الرصيد غير المؤدى",
        close: "إغلاق",
      };
    }

    if (language === "fr") {
      return {
        profileHub: "Mon profil",
        myOrders: "Mes commandes",
        accountSettings: "Paramètres du compte",
        myCarnet: "Mon carnet",
        debtLabel: "Dette",
        cartTitle: "Mon panier",
        cartSubtitle: "article(s) dans le panier",
        subtotal: "Sous-total",
        delivery: "Livraison",
        total: "Total",
        checkout: "Passer au paiement",
        carnetDetails: "Détails du carnet",
        unpaidBalance: "Solde impayé",
        close: "Fermer",
      };
    }

    return {
      profileHub: "Profile Hub",
      myOrders: "My Orders",
      accountSettings: "Account Settings",
      myCarnet: "My Carnet",
      debtLabel: "Debt",
      cartTitle: "Your Cart",
      cartSubtitle: "item(s) in your basket",
      subtotal: "Subtotal",
      delivery: "Delivery",
      total: "Total Price",
      checkout: "Proceed to Checkout",
      carnetDetails: "Carnet Details",
      unpaidBalance: "Total Unpaid Balance",
      close: "Close",
    };
  }, [language]);

  const ledgerSections = useMemo(() => {
    const transactions = (customerCarnetOverviewQuery.data?.transactions ?? []) as Array<{
      id: string;
      createdAt: string;
      description: string;
      amount: number;
      kind: "debt" | "payment";
    }>;

    const dateFormatter = new Intl.DateTimeFormat(isArabic ? "ar-MA" : "fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const timeFormatter = new Intl.DateTimeFormat(isArabic ? "ar-MA" : "fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const groups = new Map<
      string,
      {
        label: string;
        rows: Array<{
          id: string;
          title: string;
          time: string;
          amount: number;
          kind: "debt" | "payment";
        }>;
      }
    >();

    for (const transaction of transactions) {
      const date = new Date(transaction.createdAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          label: dateFormatter.format(date),
          rows: [],
        });
      }

      groups.get(dateKey)?.rows.push({
        id: transaction.id,
        title: transaction.description,
        time: timeFormatter.format(date),
        amount: Number(transaction.amount ?? 0),
        kind: transaction.kind,
      });
    }

    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([, value]) => value);
  }, [customerCarnetOverviewQuery.data?.transactions, isArabic]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bzaf_fresh_location");
      if (!raw) {
        setSelectedNeighborhoodId(null);
        return;
      }

      const parsed = JSON.parse(raw) as { neighborhoodId?: string };
      setSelectedNeighborhoodId(typeof parsed?.neighborhoodId === "string" ? parsed.neighborhoodId : null);
    } catch {
      setSelectedNeighborhoodId(null);
    }
  }, [location.pathname, isCartOpen]);

  const selectedNeighborhoodFee = useMemo(() => {
    if (!selectedNeighborhoodId) return null;

    const zones = serviceZonesQuery.data ?? [];
    for (const commune of zones) {
      const neighborhood = commune.neighborhoods.find((item) => item.id === selectedNeighborhoodId);
      if (neighborhood) {
        return Number(neighborhood.deliveryFee ?? 0);
      }
    }

    return null;
  }, [selectedNeighborhoodId, serviceZonesQuery.data]);

  const globalDeliveryFee = Number(globalSettingsQuery.data?.global_delivery_fee ?? 10);
  const freeDeliveryThreshold = Number(globalSettingsQuery.data?.free_delivery_threshold ?? 500);
  const effectiveDeliveryFee = useMemo(() => {
    if (cartTotal >= freeDeliveryThreshold) {
      return 0;
    }

    if (selectedNeighborhoodFee !== null) {
      return selectedNeighborhoodFee;
    }

    return globalDeliveryFee;
  }, [cartTotal, freeDeliveryThreshold, selectedNeighborhoodFee, globalDeliveryFee]);
  const totalWithDelivery = cartTotal + effectiveDeliveryFee;
  const amountToFreeDelivery = Math.max(freeDeliveryThreshold - cartTotal, 0);

  const handleCheckout = () => {
    if (onCheckoutClick) {
      onCheckoutClick();
      return;
    }

    closeCart();
    void navigate({ to: "/customer", hash: "checkout" });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
      if (!raw) {
        setCustomerSessionPhone(null);
        return;
      }

      const parsed = JSON.parse(raw) as { phoneNumber?: string };
      setCustomerSessionPhone(typeof parsed?.phoneNumber === "string" ? parsed.phoneNumber : null);
    } catch {
      setCustomerSessionPhone(null);
    }
  }, [location.pathname, isCustomerAuthModalOpen]);

  useEffect(() => {
    return () => {
      if (profileHubTimerRef.current) {
        window.clearTimeout(profileHubTimerRef.current);
      }
    };
  }, []);

  const openProfilePanelFromHub = (view: "orders" | "account" | "carnet") => {
    setIsProfileHubOpen(false);
    if (profileHubTimerRef.current) {
      window.clearTimeout(profileHubTimerRef.current);
    }
    profileHubTimerRef.current = window.setTimeout(() => {
      openCustomerPanel(view);
      void navigate({ to: "/customer" });
    }, 140);
  };

  const isHomeActive = location.pathname === "/customer" || location.pathname === "/customer/";
  const isSearchActive =
    location.pathname === "/customer/categories" ||
    location.pathname.startsWith("/customer/categories/") ||
    location.pathname === "/customer/all-products";
  const isCartActive = isCartOpen;
  const isProfileActive =
    isProfileHubOpen || isCustomerAuthModalOpen || customerPanelView === "profile" || location.pathname === "/profile";
  const shouldHideBottomNav =
    location.pathname.startsWith("/customer/order/") ||
    location.pathname.startsWith("/customer/digital-receipt/") ||
    location.pathname.startsWith("/customer/receipt/");
  const bottomNavAnimationClass = shouldHideBottomNav
    ? "animate-fade-out opacity-0 pointer-events-none"
    : "animate-fade-in opacity-100 pointer-events-auto";
  const navItemClass = (active: boolean) =>
    `group flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] leading-none transition-colors ${
      active ? "text-primary" : "text-muted-foreground hover:text-primary"
    }`;
  const navIconWrapClass = (active: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-full transition-all ${
      active ? "bg-primary/14 text-primary" : "text-current"
    }`;
  const latestOutForDeliveryOrderId = useMemo(
    () => getLatestOutForDeliveryOrderId(customerOrdersQuery.data),
    [customerOrdersQuery.data],
  );
  const hasOutForDeliveryShortcut = !!latestOutForDeliveryOrderId;
  const shouldUseHaptics = (() => {
    if (typeof window === "undefined") return false;
    try {
      const savedPreference = window.localStorage.getItem("bzaf.hapticsEnabled");
      if (savedPreference === "false") return false;
      if (savedPreference === "true") return true;
    } catch {
      // ignore localStorage access issues and keep graceful fallback
    }

    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  })();
  const floatingShortcutLabel =
    language === "ar"
      ? "فتح تفاصيل الطلب الجاري توصيله"
      : language === "fr"
        ? "Ouvrir les détails de la commande en livraison"
        : "Open out-for-delivery order details";

  const openLatestOutForDeliveryReceipt = () => {
    if (!latestOutForDeliveryOrderId) return;

    if (shouldUseHaptics && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(16);
    }

    void navigate({
      to: "/customer/order/$orderId",
      params: { orderId: latestOutForDeliveryOrderId },
      resetScroll: false,
    });
  };

  return (
    <>
      <main className={shouldHideBottomNav ? "pb-0 md:pb-0" : "pb-24 md:pb-0"}>
        <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
          <CustomerStatusAlert />
        </div>
        {children}
      </main>

      <nav
        className={`fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.35rem)] z-50 grid h-[74px] grid-cols-5 items-center justify-items-center rounded-[30px] border border-border/70 bg-card/90 px-1.5 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_20px_40px_-26px_rgba(17,24,39,0.45)] backdrop-blur-xl transition-all duration-300 ease-out md:hidden ${bottomNavAnimationClass}`}
      >
          <Link to="/" className={navItemClass(isHomeActive)}>
            <span className={navIconWrapClass(isHomeActive)}>
              <House className="size-5" />
            </span>
            <span className="font-medium">{t("nav.home")}</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (onSearchClick) {
                onSearchClick();
              } else {
                void navigate({ to: "/customer/categories" });
              }
            }}
            className={navItemClass(isSearchActive)}
          >
            <span className={navIconWrapClass(isSearchActive)}>
              <Search className="size-5" />
            </span>
            <span>{t("nav.search")}</span>
          </button>

          <div className="flex h-full w-full items-center justify-center">
            <button
              type="button"
              dir="ltr"
              aria-label={floatingShortcutLabel}
              aria-disabled={!hasOutForDeliveryShortcut}
              onClick={openLatestOutForDeliveryReceipt}
              className={`relative -top-3.5 z-50 mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-[0_18px_32px_-16px_rgba(24,181,106,0.85)] transition-all duration-200 ease-out active:scale-[0.94] ${
                hasOutForDeliveryShortcut ? "opacity-100" : "cursor-default opacity-80"
              }`}
            >
              <Package className="h-6 w-6 shrink-0 text-primary-foreground" />
              {hasOutForDeliveryShortcut ? (
                <span
                  className={`pointer-events-none absolute top-1.5 z-[70] inline-flex h-2.5 w-2.5 animate-[pulse_1.05s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full bg-destructive shadow-[0_0_0_4px_color-mix(in_oklab,var(--destructive)_22%,transparent)] ${
                    isArabic ? "left-1.5" : "right-1.5"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </div>

          <button
            type="button"
            onClick={openCart}
            className={navItemClass(isCartActive)}
            aria-label={cartLabel}
          >
            <span className="relative">
              <span className={navIconWrapClass(isCartActive)}>
                <ShoppingCart className="size-5" />
              </span>
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                {cartCount}
              </span>
            </span>
            <span>{t("nav.cart")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsProfileHubOpen(true);
            }}
            className={navItemClass(isProfileActive)}
          >
            <span className={navIconWrapClass(isProfileActive)}>
              <UserCircle2 className="size-5" />
            </span>
            <span>{t("nav.profile")}</span>
          </button>
      </nav>

      {isProfileHubOpen ? (
        <div className="fixed inset-0 z-[110] md:hidden">
          <button
            type="button"
            aria-label="Close profile menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsProfileHubOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-background p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
            <h2 className={`text-sm font-semibold text-foreground ${isArabic ? "text-right" : "text-left"}`}>{layoutCopy.profileHub}</h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => openProfilePanelFromHub("orders")}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition hover:bg-muted"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{layoutCopy.myOrders}</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => openProfilePanelFromHub("account")}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition hover:bg-muted"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{layoutCopy.accountSettings}</span>
                </span>
              </button>

              {customerCarnetBalanceQuery.isLoading && customerSessionPhone ? (
                <div className="h-[78px] w-full animate-pulse rounded-xl border border-border bg-card" />
              ) : null}

              {customerCarnetBalanceQuery.data?.hasCarnet ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileHubOpen(false);
                    setIsCarnetDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition hover:bg-muted"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 flex-col">
                    <span className="block text-sm font-semibold text-foreground">{layoutCopy.myCarnet}</span>
                    <div className="text-red-500 font-semibold text-sm mt-1">
                      {layoutCopy.debtLabel}: {Number(customerCarnetBalanceQuery.data?.totalDebtMad ?? 0).toFixed(2)} MAD
                    </div>
                  </span>
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {isCartOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-start justify-between border-b border-border p-5">
              <div>
                <h2 className={`text-xl font-semibold text-foreground ${isArabic ? "text-right" : "text-left"}`}>{layoutCopy.cartTitle}</h2>
                <p className={`text-sm text-muted-foreground ${isArabic ? "text-right" : "text-left"}`}>{cartLabel} {layoutCopy.cartSubtitle}</p>
              </div>
              <button
                aria-label="Close cart drawer"
                onClick={closeCart}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <ShoppingCart className="size-6" />
                </div>
                <p className="mt-5 text-lg font-semibold text-foreground">Your cart is empty</p>
                <p className="mt-2 text-sm text-muted-foreground">Let&apos;s get some fresh groceries!</p>
                <Button variant="hero" className="mt-6 rounded-xl" onClick={closeCart}>
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {cartItems.map((item) => (
                    <article
                      key={item.id}
                      className="surface-panel flex items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <img
                        src={item.image}
                        alt={item.alt}
                        className="h-14 w-14 rounded-lg bg-muted/40 object-contain object-center p-1"
                        width={112}
                        height={112}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="text-sm font-medium text-primary">{item.price} MAD</p>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <button
                            aria-label={`Decrease quantity of ${item.name}`}
                            onClick={() => decreaseItem(item.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-muted"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            aria-label={`Increase quantity of ${item.name}`}
                            onClick={() => increaseItem(item.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-muted"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <button
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeItem(item.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </article>
                  ))}
                </div>

                <div className="border-t border-border p-5">
                  <div className="mb-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">{layoutCopy.subtotal}</p>
                      <p className="text-sm font-semibold text-foreground">{cartTotal.toFixed(2)} MAD</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">{layoutCopy.delivery}</p>
                      <p className="text-sm font-semibold text-foreground">{effectiveDeliveryFee.toFixed(2)} MAD</p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm font-medium text-muted-foreground">{layoutCopy.total}</p>
                      <p className="text-xl font-semibold text-foreground">{totalWithDelivery.toFixed(2)} MAD</p>
                    </div>
                  </div>

                  {cartItems.length > 0 ? (
                    <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                      <p className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                        <Gift className="size-3.5" />
                        {amountToFreeDelivery > 0
                          ? isArabic
                            ? `زيد ${amountToFreeDelivery.toFixed(2)} درهم باش تستافد من توصيل فابور!`
                            : `Spend ${amountToFreeDelivery.toFixed(2)} MAD more to get FREE Delivery!`
                          : isArabic
                            ? "مبروك! عندك توصيل فابور"
                            : "You have unlocked Free Delivery! 🎉"}
                      </p>
                    </div>
                  ) : null}

                  <div className="mb-4" />
                  <div>
                    <Button variant="hero" size="lg" className="w-full rounded-xl" onClick={handleCheckout}>
                      {layoutCopy.checkout}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}

      <Dialog open={isCarnetDialogOpen} onOpenChange={setIsCarnetDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl border-border bg-background/95 p-0 backdrop-blur-sm">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle>{layoutCopy.carnetDetails}</DialogTitle>
            <DialogDescription className="mt-2 space-y-1 text-left">
              <p className="text-xs text-muted-foreground">{layoutCopy.unpaidBalance}</p>
              <p className="text-2xl font-bold text-destructive">
                {Number(customerCarnetOverviewQuery.data?.carnet?.currentDebt ?? customerCarnetBalanceQuery.data?.totalDebtMad ?? 0).toFixed(2)}
                <span className="ml-1 text-base font-semibold">MAD</span>
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[52vh] overflow-y-auto px-5 py-3">
            {customerCarnetOverviewQuery.isLoading ? (
              <div className="space-y-3 py-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`ledger-skeleton-${index}`} className="h-12 animate-pulse rounded-lg bg-muted/50" />
                ))}
              </div>
            ) : ledgerSections.length === 0 ? (
              <AppEmptyState
                title="No carnet transactions yet."
                subtitle="Your ledger activity will appear here once you place carnet orders or make payments."
                className="px-4 py-6"
              />
            ) : (
              <div className="space-y-4">
                {ledgerSections.map((section) => (
                  <section key={section.label}>
                    <div className="sticky top-0 z-10 border-b border-border bg-background/95 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                      {section.label}
                    </div>
                    <div>
                      {section.rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
                          <div className="min-w-0 flex flex-1 items-center gap-3">
                            <span
                              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                row.kind === "debt" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                              }`}
                            >
                              {row.kind === "debt" ? <ShoppingBag className="size-4" /> : <BadgeCheck className="size-4" />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
                              <p className="text-xs text-muted-foreground">{row.time}</p>
                            </div>
                          </div>
                          <div
                            className={`shrink-0 text-right text-sm font-semibold ${
                              row.kind === "debt" ? "text-destructive" : "text-success"
                            }`}
                          >
                            {row.kind === "debt" ? "+" : "-"} {row.amount.toFixed(2)} MAD
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border bg-background/95 px-5 py-4">
            <Button className="w-full" onClick={() => setIsCarnetDialogOpen(false)}>
              {layoutCopy.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
