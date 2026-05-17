import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useReactToPrint } from "react-to-print";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  Banknote,
  BadgeCheck,
  Boxes,
  Zap,
  BookUser,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  LogOut,
  Bike,
  Package,
  Phone,
  MessageSquare,
  Search,
  ShoppingBag,
  Store,
  Truck,
  User,
  Users,
  Tag,
  Scale,
  QrCode,
  Volume2,
  VolumeX,
  Wallet,
  MapPin,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getVendorInventoryData, updateVendorFlashSale, upsertVendorInventoryItem } from "@/lib/catalog.functions";
import {
  getCarnetCustomerLedger,
  getVendorCarnetData,
  lookupCustomerByPhone,
  recordVendorCarnetPayment,
  verifyAndAddVendorCarnetCustomer,
} from "@/lib/carnet.functions";
import { createOtpRequest } from "@/lib/customers.functions";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import { getVendorDashboardData, updateVendorOrderStatus } from "@/lib/orders.functions";
import { getInvoiceSettings } from "@/lib/invoice-settings.functions";
import { playAlertSound } from "@/lib/sound-alerts";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { clearRoleSessions } from "@/lib/operational-auth";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS, fr } from "date-fns/locale";
import {
  DEFAULT_RECEIPT_ADDRESS,
  DEFAULT_RECEIPT_FOOTER_MESSAGE,
  DEFAULT_RECEIPT_PHONE,
  DEFAULT_RECEIPT_SLOGAN,
  DEFAULT_RECEIPT_SOCIAL_SUPPORT,
  DEFAULT_RECEIPT_STORE_NAME,
  DEFAULT_RECEIPT_WEBSITE,
} from "@/lib/receipt-settings.defaults";
import {
  ThermalReceipt,
  type ThermalInvoiceSettings,
  type ThermalReceiptOrder,
} from "@/components/ThermalReceipt";
import { useAppLanguage } from "@/hooks/use-localization";
import { getLocalizedValue, withLocale } from "@/lib/localization";

type MainView = "orders" | "history" | "inventory" | "flashSales" | "carnet";
type OrderQueueTab = "pending" | "preparing" | "ready" | "inDelivery";
type HistoryFilter = "today" | "week" | "month" | "all";
type CarnetLedgerTransaction = {
  id: string;
  createdAt: string;
  description: string;
  amount: number;
  kind: "debt" | "payment";
};

type LedgerOrderItem = {
  name: string;
  quantity: number;
  unitPriceMad: number;
};

const INCOMING_ALERT_CACHE_TTL_MS = 15 * 60 * 1000;
const INCOMING_ALERT_CACHE_MAX_ITEMS = 160;

function incomingAlertCacheKey(phoneNumber: string) {
  return `vendor.incoming-order-alerts.${phoneNumber}`;
}

function readIncomingAlertCache(phoneNumber: string) {
  if (typeof window === "undefined" || !phoneNumber) return new Map<string, number>();

  try {
    const raw = window.localStorage.getItem(incomingAlertCacheKey(phoneNumber));
    if (!raw) return new Map<string, number>();

    const parsed = JSON.parse(raw) as Array<{ id?: string; seenAt?: number }>;
    const now = Date.now();
    const next = new Map<string, number>();

    for (const entry of parsed) {
      if (!entry?.id || typeof entry.seenAt !== "number") continue;
      if (now - entry.seenAt > INCOMING_ALERT_CACHE_TTL_MS) continue;
      next.set(entry.id, entry.seenAt);
    }

    return next;
  } catch {
    return new Map<string, number>();
  }
}

function writeIncomingAlertCache(phoneNumber: string, cache: Map<string, number>) {
  if (typeof window === "undefined" || !phoneNumber) return;

  const now = Date.now();
  const entries = Array.from(cache.entries())
    .filter(([, seenAt]) => now - seenAt <= INCOMING_ALERT_CACHE_TTL_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, INCOMING_ALERT_CACHE_MAX_ITEMS)
    .map(([id, seenAt]) => ({ id, seenAt }));

  try {
    window.localStorage.setItem(incomingAlertCacheKey(phoneNumber), JSON.stringify(entries));
  } catch {
    // ignore localStorage write errors (quota/privacy mode)
  }
}

function roundMoney(value: number) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

const VENDOR_SOUNDS_STORAGE_KEY = "bzaf.vendorSoundsEnabled";
const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";

const vendorDashboardSearchSchema = z.object({
  tab: fallback(z.enum(["live", "inventory", "flash-sales", "carnet", "history"]), "live").default("live"),
  sub: fallback(z.enum(["pending", "preparing", "ready", "inDelivery"]), "pending").default("pending"),
});

type VendorDashboardSearch = z.infer<typeof vendorDashboardSearchSchema>;

type DashboardOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  specificAddress?: string | null;
  neighborhoodName: string;
  communeName: string;
  deliveryNotes: string;
  paymentMethod: "COD" | "Carnet";
  status:
    | "pending"
    | "new"
    | "preparing"
    | "ready"
    | "in_delivery"
    | "in_transit"
    | "delivering"
    | "delivered"
    | "delivered_cash_with_cyclist"
    | "cash_transferred_to_vendor";
  deliveryFeeMad: number;
  totalMad: number;
  vendorShareMad: number;
  platformProfitMad: number;
  platformMarkupMad: number;
  subtotalBasePriceMad: number;
  itemCount: number;
  items: Array<{
    productId?: string | null;
    name: string;
    selectedVariant?: string | null;
    quantity: number;
    unitPriceMad: number;
    imageUrl?: string | null;
    brandName?: string | null;
    categoryLabel?: string | null;
    measurementValue?: number | null;
    measurementUnit?: string | null;
  }>;
  cyclist?: {
    id: string;
    name: string;
    phoneNumber: string;
    avatarUrl?: string | null;
  } | null;
  createdAt: string;
};

function normalizeVendorLiveStatus(status: string): DashboardOrder["status"] {
  if (status === "picked_up" || status === "in_transit" || status === "in_delivery" || status === "delivering") {
    return "in_delivery";
  }

  if (status === "pending" || status === "new") {
    return "pending";
  }

  if (status === "preparing" || status === "ready" || status === "delivered" || status === "delivered_cash_with_cyclist" || status === "cash_transferred_to_vendor") {
    return status;
  }

  return "pending";
}

type InventoryItem = {
  id: string;
  name: string;
  nameFr?: string | null;
  nameAr?: string | null;
  category?: string;
  productVariants?: string[];
  measurementValue?: number | null;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  measurementUnitLabel?: string;
  imageUrl?: string | null;
  vendorPrice: number;
  isAvailable: boolean;
  isFlashSale: boolean;
  flashSalePrice: number | null;
  flashSaleEndTime: string | null;
};

export const Route = createFileRoute("/vendor/dashboard")({
  validateSearch: zodValidator(vendorDashboardSearchSchema),
  head: () => ({
    meta: [
      { title: i18n.t("vendorDashboard.meta.title") },
      {
        name: "description",
        content: i18n.t("vendorDashboard.meta.description"),
      },
    ],
  }),
  component: VendorDashboardPage,
});

function VendorDashboardPage() {
  const { t } = useTranslation();
  const { language: activeLanguage, intlLocale } = useAppLanguage();
  const navigate = useNavigate({ from: "/vendor/dashboard" });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<HistoryFilter>("all");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("today");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [inventoryDraft, setInventoryDraft] = useState<
    Record<string, { vendorPrice: string; isAvailable: boolean }>
  >({});
  const [flashDraft, setFlashDraft] = useState<Record<string, { enabled: boolean; price: string; endAt: string }>>({});
  const [isSavingInventoryFor, setIsSavingInventoryFor] = useState<string | null>(null);
  const [isSavingFlashFor, setIsSavingFlashFor] = useState<string | null>(null);
  const [trustedCustomerPhone, setTrustedCustomerPhone] = useState("");
  const [trustedCustomerMaxLimit, setTrustedCustomerMaxLimit] = useState("");
  const [trustedCustomerName, setTrustedCustomerName] = useState("");
  const [trustedCustomerCin, setTrustedCustomerCin] = useState("");
  const [existingCustomerLookup, setExistingCustomerLookup] = useState<{
    found: boolean;
    fullName: string | null;
  } | null>(null);
  const [phoneForPendingCarnetVerification, setPhoneForPendingCarnetVerification] = useState<string | null>(null);
  const [otpCodeForCarnetVerification, setOtpCodeForCarnetVerification] = useState("");
  const [isCarnetOtpModalOpen, setIsCarnetOtpModalOpen] = useState(false);
  const [pendingCarnetPayload, setPendingCarnetPayload] = useState<{
    customerPhone: string;
    maxLimit: number;
    customerName?: string;
    customerCin: string;
  } | null>(null);
  const [isSavingCarnet, setIsSavingCarnet] = useState(false);
  const [selectedCarnetPhone, setSelectedCarnetPhone] = useState<string | null>(null);
  const [ledgerPaymentAmount, setLedgerPaymentAmount] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [expandedLedgerOrderIds, setExpandedLedgerOrderIds] = useState<Record<string, boolean>>({});
  const [rejectedOrderIds, setRejectedOrderIds] = useState<Record<string, boolean>>({});
  const [packingOrderId, setPackingOrderId] = useState<string | null>(null);
  const [packingProgressByOrder, setPackingProgressByOrder] = useState<Record<string, Record<string, boolean>>>({});
  const [timeTick, setTimeTick] = useState(Date.now());
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [hasAudioPermissionHintShown, setHasAudioPermissionHintShown] = useState(false);
  const shownIncomingToastIdsRef = useRef<Map<string, number>>(new Map());
  const shownSettlementToastIdsRef = useRef<Map<string, number>>(new Map());
  const incomingAlertCachePhoneRef = useRef<string>("");
  const [printOrder, setPrintOrder] = useState<DashboardOrder | null>(null);
  const receiptPrintRef = useRef<HTMLDivElement | null>(null);
  const vendorPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.vendorSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);
  const normalizedVendorPhoneNumber = useMemo(
    () => formatMoroccoPhoneForPayload(normalizeMoroccoPhoneInput(vendorPhoneNumber)),
    [vendorPhoneNumber],
  );
  const hasValidVendorPhoneSession = useMemo(
    () => isValidMoroccoPhone(normalizeMoroccoPhoneInput(vendorPhoneNumber)),
    [vendorPhoneNumber],
  );

  useEffect(() => {
    if (!normalizedVendorPhoneNumber) {
      shownIncomingToastIdsRef.current = new Map();
      incomingAlertCachePhoneRef.current = "";
      return;
    }

    if (incomingAlertCachePhoneRef.current === normalizedVendorPhoneNumber) {
      return;
    }

    shownIncomingToastIdsRef.current = readIncomingAlertCache(normalizedVendorPhoneNumber);
    incomingAlertCachePhoneRef.current = normalizedVendorPhoneNumber;
  }, [normalizedVendorPhoneNumber]);

  const fetchDashboardData = useServerFn(getVendorDashboardData);
  const fetchInvoiceSettings = useServerFn(getInvoiceSettings);
  const fetchInventoryData = useServerFn(getVendorInventoryData);
  const saveInventoryItem = useServerFn(upsertVendorInventoryItem);
  const saveFlashSale = useServerFn(updateVendorFlashSale);
  const updateStatus = useServerFn(updateVendorOrderStatus);
  const fetchVendorCarnetData = useServerFn(getVendorCarnetData);
  const fetchCarnetLedger = useServerFn(getCarnetCustomerLedger);
  const lookupCustomer = useServerFn(lookupCustomerByPhone);
  const requestOtp = useServerFn(createOtpRequest);
  const verifyAndAddTrustedCustomer = useServerFn(verifyAndAddVendorCarnetCustomer);
  const recordCarnetPayment = useServerFn(recordVendorCarnetPayment);

  const mainView: MainView =
    search.tab === "live"
      ? "orders"
      : search.tab === "inventory"
        ? "inventory"
        : search.tab === "flash-sales"
          ? "flashSales"
        : search.tab === "carnet"
          ? "carnet"
          : "history";

  const activeTab: OrderQueueTab = search.sub;

  const setMainView = (view: MainView) => {
    const tab =
      view === "orders"
        ? "live"
        : view === "inventory"
          ? "inventory"
          : view === "flashSales"
            ? "flash-sales"
            : view === "carnet"
              ? "carnet"
              : "history";
    navigate({
      search: (prev: VendorDashboardSearch) => ({
        ...prev,
        tab,
      }),
      replace: true,
    });
  };

  const setActiveTab = (tab: OrderQueueTab) => {
    navigate({
      search: (prev: VendorDashboardSearch) => ({
        ...prev,
        tab: "live",
        sub: tab,
      }),
      replace: true,
    });
  };

  const dateFnsLocale = activeLanguage === "ar" ? arSA : activeLanguage === "fr" ? fr : enUS;

  const localizeMeasurementUnit = (value: string | null | undefined) => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return "";

    if (normalized === "kg" || normalized === "kilogram" || normalized === "kilograms") {
      return t("vendorDashboard.packOrder.units.kg", { defaultValue: "Kg" });
    }
    if (normalized === "liter" || normalized === "litre" || normalized === "liters" || normalized === "litres" || normalized === "l") {
      return t("vendorDashboard.packOrder.units.liter", { defaultValue: "Liter" });
    }
    if (normalized === "piece" || normalized === "pcs" || normalized === "pc") {
      return t("vendorDashboard.packOrder.units.piece", { defaultValue: "Piece" });
    }
    if (normalized === "pack") {
      return t("vendorDashboard.packOrder.units.pack", { defaultValue: "Pack" });
    }
    if (normalized === "gram" || normalized === "grams" || normalized === "g") {
      return t("vendorDashboard.packOrder.units.gram", { defaultValue: "Gram" });
    }
    if (normalized === "bunch") {
      return t("vendorDashboard.packOrder.units.bunch", { defaultValue: "Bunch" });
    }
    if (normalized === "tray") {
      return t("vendorDashboard.packOrder.units.tray", { defaultValue: "Tray" });
    }
    if (normalized === "box") {
      return t("vendorDashboard.packOrder.units.box", { defaultValue: "Box" });
    }

    return value?.trim() ?? "";
  };

  const localizeCategoryLabel = (value: unknown) => {
    const localized = getLocalizedValue(value, activeLanguage, "").trim();
    if (!localized) return "";
    return t(`categoryNames.${localized}`, { defaultValue: localized });
  };

  const dashboardQuery = useQuery({
    queryKey: ["vendor", "dashboard", activeLanguage],
    queryFn: () =>
      fetchDashboardData({
        data: withLocale(activeLanguage, { phoneNumber: normalizedVendorPhoneNumber }),
      }),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
    enabled: hasValidVendorPhoneSession,
  });

  const invoiceSettingsQuery = useQuery({
    queryKey: ["vendor", "invoice-settings"],
    queryFn: () => fetchInvoiceSettings(),
    staleTime: 60_000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["vendor", "inventory", activeLanguage],
    queryFn: () => fetchInventoryData({ data: withLocale(activeLanguage, { phoneNumber: normalizedVendorPhoneNumber }) }),
    placeholderData: (previousData) => previousData,
    enabled: hasValidVendorPhoneSession,
  });

  const carnetQuery = useQuery({
    queryKey: ["vendor", "carnet"],
    queryFn: () => fetchVendorCarnetData({ data: { phoneNumber: normalizedVendorPhoneNumber } }),
    refetchInterval: 5_000,
    placeholderData: (previousData) => previousData,
    enabled: hasValidVendorPhoneSession,
  });

  const ledgerQuery = useQuery({
    queryKey: ["vendor", "carnet", "ledger", selectedCarnetPhone],
    queryFn: () =>
      fetchCarnetLedger({ data: { customerPhone: selectedCarnetPhone!, phoneNumber: normalizedVendorPhoneNumber } }),
    enabled: !!selectedCarnetPhone && hasValidVendorPhoneSession,
  });

  useEffect(() => {
    if (hasValidVendorPhoneSession) return;
    toast.error(t("vendorDashboard.toasts.invalidSession"));
    clearRoleSessions();
    void navigate({ to: "/vendor/login" });
  }, [hasValidVendorPhoneSession, navigate, t]);

  const isDashboardInitialLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const isInventoryInitialLoading = inventoryQuery.isLoading && !inventoryQuery.data;
  const isCarnetInitialLoading = carnetQuery.isLoading && !carnetQuery.data;
  const isLedgerInitialLoading = ledgerQuery.isLoading && !ledgerQuery.data;

  useEffect(() => {
    const channel = supabase
      .channel("vendor-dashboard-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          queryClient.setQueryData(["vendor", "dashboard"], (current: any) => {
            if (!current || !Array.isArray(current.orders)) {
              return current;
            }

            const eventType = payload.eventType;
            const nextOrders = [...current.orders];

            if (eventType === "INSERT") {
              const inserted = payload.new as any;
              if (inserted?.vendor_id !== current.vendor?.id) {
                return current;
              }
              if (!inserted?.id || nextOrders.some((order) => order?.id === inserted.id)) {
                return current;
              }

              nextOrders.unshift(inserted);
            }

            if (eventType === "UPDATE") {
              const updated = payload.new as any;
              if (updated?.vendor_id !== current.vendor?.id) {
                return current;
              }
              if (!updated?.id) {
                return current;
              }

               if (updated?.status === "cash_transferred_to_vendor") {
                const settledOrderId = String(updated.id);
                const alreadyShown = shownSettlementToastIdsRef.current.get(settledOrderId);
                if (!alreadyShown) {
                  shownSettlementToastIdsRef.current.set(settledOrderId, Date.now());
                  const vendorProfit = roundMoney(Number(updated.vendor_revenue ?? Math.max(Number(updated.total_price ?? 0) - Number(updated.delivery_fee ?? 0), 0)));
                  const platformDues = roundMoney(Number(updated.platform_profit ?? 0));
                  toast.success(
                    `تم استلام مبلغ الطلب #${settledOrderId.slice(0, 8)} من رجل التوصيل. أرباحك: ${vendorProfit.toFixed(2)} درهم، ومستحقات التطبيق: ${platformDues.toFixed(2)} درهم.`,
                  );
                }
              }

              const index = nextOrders.findIndex((order) => order?.id === updated.id);
              if (index === -1) {
                return current;
              }

              nextOrders[index] = {
                ...nextOrders[index],
                ...updated,
              };
            }

            if (eventType === "DELETE") {
              const deleted = payload.old as any;
              if (deleted?.vendor_id !== current.vendor?.id) {
                return current;
              }
              if (!deleted?.id) {
                return current;
              }

              const filtered = nextOrders.filter((order) => order?.id !== deleted.id);
              if (filtered.length === nextOrders.length) {
                return current;
              }

              return {
                ...current,
                orders: filtered,
              };
            }

            nextOrders.sort((a, b) => {
              const aTime = new Date(a?.created_at ?? 0).getTime();
              const bTime = new Date(b?.created_at ?? 0).getTime();
              return bTime - aTime;
            });

            return {
              ...current,
              orders: nextOrders,
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!hasValidVendorPhoneSession) {
      return;
    }

    const alertChannel = supabase
      .channel(`vendor-new-order-alerts-${normalizedVendorPhoneNumber}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const inserted = payload.new as {
            id?: string;
            vendor_id?: string;
            status?: string;
            total_price?: number | string;
          };

          const knownVendorId = dashboardQuery.data?.vendor?.id;
          if (!knownVendorId || inserted?.vendor_id !== knownVendorId) {
            return;
          }

          if (!(inserted?.status === "pending" || inserted?.status === "new") || !inserted?.id) {
            return;
          }

          const insertedId = inserted.id;

          const now = Date.now();
          const seenAt = shownIncomingToastIdsRef.current.get(insertedId);
          if (typeof seenAt === "number" && now - seenAt <= INCOMING_ALERT_CACHE_TTL_MS) {
            return;
          }

          shownIncomingToastIdsRef.current.set(insertedId, now);

          for (const [cachedId, cachedAt] of shownIncomingToastIdsRef.current.entries()) {
            if (now - cachedAt > INCOMING_ALERT_CACHE_TTL_MS) {
              shownIncomingToastIdsRef.current.delete(cachedId);
            }
          }

          if (shownIncomingToastIdsRef.current.size > INCOMING_ALERT_CACHE_MAX_ITEMS) {
            const oldestEntry = [...shownIncomingToastIdsRef.current.entries()].sort((a, b) => a[1] - b[1])[0];
            if (oldestEntry) {
              shownIncomingToastIdsRef.current.delete(oldestEntry[0]);
            }
          }

          writeIncomingAlertCache(normalizedVendorPhoneNumber, shownIncomingToastIdsRef.current);

          const totalMad = roundMoney(Number(inserted.total_price ?? 0));
          const toastId = `incoming-order-${insertedId}`;

          if (isSoundEnabled) {
            void playAlertSound({ enabled: true }).then((played) => {
              if (!played && !hasAudioPermissionHintShown) {
              toast.info(t("vendorDashboard.toasts.enableSoundHint"));
                setHasAudioPermissionHintShown(true);
              }
            });
          }

          toast.custom(
            () => (
              <div className="w-[min(360px,92vw)] rounded-xl border border-success/25 bg-card p-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/12 text-success">
                    <ShoppingBag className="size-4" />
                    <span className="absolute inset-0 rounded-full border border-success/35 animate-ping" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t("vendorDashboard.toasts.newOrderTitle")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("vendorDashboard.toasts.orderSummary", { orderId: shortOrderId(insertedId), amount: totalMad.toFixed(2) })}
                    </p>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="soft"
                        className="h-8 rounded-lg"
                        onClick={() => {
                          void navigate({
                            search: (prev: VendorDashboardSearch) => ({
                              ...prev,
                              tab: "live",
                              sub: "pending",
                            }),
                            replace: true,
                          });
                          toast.dismiss(toastId);
                        }}
                      >
                        {t("vendorDashboard.actions.viewOrder")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ),
            {
              id: toastId,
              duration: 6000,
              position: "top-right",
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(alertChannel);
    };
  }, [
    dashboardQuery.data?.vendor?.id,
    hasAudioPermissionHintShown,
    hasValidVendorPhoneSession,
    isSoundEnabled,
    navigate,
    normalizedVendorPhoneNumber,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasValidVendorPhoneSession) return;

    const refreshCarnetQueries = () => {
      void queryClient.invalidateQueries({ queryKey: ["vendor", "carnet"] });
      if (selectedCarnetPhone) {
        void queryClient.invalidateQueries({ queryKey: ["vendor", "carnet", "ledger", selectedCarnetPhone] });
      }
    };

    const ordersChannel = supabase
      .channel(`vendor-carnet-orders-${normalizedVendorPhoneNumber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshCarnetQueries)
      .subscribe();

    const paymentsChannel = supabase
      .channel(`vendor-carnet-payments-${normalizedVendorPhoneNumber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carnet_payments" }, refreshCarnetQueries)
      .subscribe();

    const ledgerChannel = supabase
      .channel(`vendor-carnet-ledger-${normalizedVendorPhoneNumber}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carnet_transactions" }, refreshCarnetQueries)
      .subscribe();

    return () => {
      void supabase.removeChannel(ordersChannel);
      void supabase.removeChannel(paymentsChannel);
      void supabase.removeChannel(ledgerChannel);
    };
  }, [hasValidVendorPhoneSession, normalizedVendorPhoneNumber, queryClient, selectedCarnetPhone]);

  const vendorStoreName =
    dashboardQuery.data?.vendor?.storeName ?? inventoryQuery.data?.vendor?.store_name ?? "Vendor Store";

  const normalizedTrustedCustomerPhone = useMemo(
    () => normalizeMoroccoPhoneInput(trustedCustomerPhone),
    [trustedCustomerPhone],
  );
  const trustedCustomerFullPhone = useMemo(
    () => formatMoroccoPhoneForPayload(normalizedTrustedCustomerPhone),
    [normalizedTrustedCustomerPhone],
  );
  const isTrustedCustomerPhoneValid = useMemo(
    () => isValidMoroccoPhone(normalizedTrustedCustomerPhone),
    [normalizedTrustedCustomerPhone],
  );

  useEffect(() => {
    if (!isTrustedCustomerPhoneValid) {
      setExistingCustomerLookup(null);
      return;
    }

    let cancelled = false;
    const lookupTimer = window.setTimeout(async () => {
      try {
        const result = await lookupCustomer({ data: { customerPhone: trustedCustomerFullPhone } });
        if (cancelled) {
          return;
        }

        if (result.found) {
          setExistingCustomerLookup({
            found: true,
            fullName: result.customer?.fullName ?? null,
          });
          setTrustedCustomerName(result.customer?.fullName ?? "");
          return;
        }

        setExistingCustomerLookup({ found: false, fullName: null });
      } catch (error) {
        console.error("Customer phone lookup failed:", error);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(lookupTimer);
    };
  }, [isTrustedCustomerPhoneValid, lookupCustomer, trustedCustomerFullPhone]);

  const orders = useMemo<DashboardOrder[]>(() => {
    const rows = dashboardQuery.data?.orders ?? [];
    return rows
      .map((row) => ({
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        specificAddress: typeof row.specific_address === "string" ? row.specific_address : null,
        neighborhoodName: typeof row.neighborhood_name === "string" ? row.neighborhood_name : "-",
        communeName: typeof row.commune_name === "string" ? row.commune_name : "-",
        deliveryNotes: getLocalizedValue((row as { delivery_notes?: unknown }).delivery_notes, activeLanguage, ""),
        paymentMethod: row.payment_method,
        status: normalizeVendorLiveStatus(row.status),
        deliveryFeeMad: roundMoney(Number(row.delivery_fee ?? 0)),
        totalMad: roundMoney(Number(row.total_price ?? 0)),
        vendorShareMad: roundMoney(
          Number.isFinite(Number(row.vendor_revenue))
            ? Number(row.vendor_revenue)
            : Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0),
        ),
        platformProfitMad: roundMoney(
          Number.isFinite(Number(row.platform_profit)) ? Number(row.platform_profit) : Number(row.delivery_fee ?? 0),
        ),
        platformMarkupMad: roundMoney(
          Number.isFinite(Number((row as { platform_markup?: number | null }).platform_markup))
            ? Number((row as { platform_markup?: number | null }).platform_markup)
            : Number.isFinite(Number(row.platform_profit))
              ? Number(row.platform_profit)
              : Number(row.delivery_fee ?? 0),
        ),
        subtotalBasePriceMad: roundMoney(Number((row as { subtotal_base_price?: number | null }).subtotal_base_price ?? 0)),
        itemCount: Number(row.item_count ?? 0),
        items: Array.isArray(row.order_items)
          ? row.order_items.map((item) => ({
              ...item,
              name: getLocalizedValue((item as { name?: unknown }).name, activeLanguage, ""),
              selectedVariant: getLocalizedValue(
                (item as { selectedVariant?: unknown }).selectedVariant,
                activeLanguage,
                "",
              ) || null,
              brandName: getLocalizedValue((item as { brandName?: unknown }).brandName, activeLanguage, "") || null,
              categoryLabel:
                localizeCategoryLabel((item as { categoryLabel?: unknown }).categoryLabel) ||
                localizeCategoryLabel((item as { categoryName?: unknown }).categoryName) ||
                localizeCategoryLabel((item as { category?: unknown }).category) ||
                null,
              measurementUnit: getLocalizedValue(
                (item as { measurementUnit?: unknown }).measurementUnit,
                activeLanguage,
                "",
              ) || null,
              imageUrl:
                typeof (item as { imageUrl?: unknown }).imageUrl === "string"
                  ? ((item as { imageUrl?: string }).imageUrl ?? null)
                  : typeof (item as { image_url?: unknown }).image_url === "string"
                    ? ((item as { image_url?: string }).image_url ?? null)
                    : null,
            }))
          : [],
        cyclist:
          row.cyclist && typeof row.cyclist.name === "string" && typeof row.cyclist.phoneNumber === "string"
            ? {
                id: row.cyclist.id,
                name: row.cyclist.name,
                phoneNumber: row.cyclist.phoneNumber,
                avatarUrl: row.cyclist.avatarUrl ?? null,
              }
            : null,
        createdAt: row.created_at,
      }))
      .filter((order) => !rejectedOrderIds[order.id]);
  }, [activeLanguage, dashboardQuery.data, rejectedOrderIds, t]);

  const queue = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === "pending" || order.status === "new"),
      preparing: orders.filter((order) => order.status === "preparing"),
      ready: orders.filter((order) => order.status === "ready"),
      inDelivery: orders.filter((order) => order.status === "in_delivery" || order.status === "in_transit" || order.status === "delivering"),
      delivered: orders.filter(
        (order) =>
          order.status === "delivered" ||
          order.status === "delivered_cash_with_cyclist" ||
          order.status === "cash_transferred_to_vendor",
      ),
    }),
    [orders],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsSoundEnabled(localStorage.getItem(VENDOR_SOUNDS_STORAGE_KEY) === "1");
  }, []);

  const handleToggleSounds = async () => {
    const nextEnabled = !isSoundEnabled;
    setIsSoundEnabled(nextEnabled);

    if (typeof window !== "undefined") {
      localStorage.setItem(VENDOR_SOUNDS_STORAGE_KEY, nextEnabled ? "1" : "0");
    }

    if (!nextEnabled) {
      toast.success(t("vendorDashboard.toasts.soundsDisabled"));
      return;
    }

    const played = await playAlertSound({ enabled: true });
    if (!played) {
      toast.error(t("vendorDashboard.toasts.autoplayBlocked"));
      return;
    }

    toast.success(t("vendorDashboard.toasts.soundsEnabled"));
  };

  const quickStats = useMemo(() => {
    const now = new Date();
    const inKpiWindow = (createdAt: string) => {
      const date = new Date(createdAt);
      if (Number.isNaN(date.getTime())) {
        return false;
      }

      const normalizedDate = date.getTime();

      if (kpiFilter === "all") {
        return true;
      }

      if (kpiFilter === "today") {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        return normalizedDate >= startOfDay.getTime() && normalizedDate < endOfDay.getTime();
      }

      if (kpiFilter === "week") {
        const startOfWeek = new Date(now);
        const dayOffset = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(now);
        endOfWeek.setHours(23, 59, 59, 999);
        return normalizedDate >= startOfWeek.getTime() && normalizedDate <= endOfWeek.getTime();
      }

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      endOfMonth.setMilliseconds(-1);
      return normalizedDate >= startOfMonth.getTime() && normalizedDate <= endOfMonth.getTime();
    };

    const pendingOrders = queue.pending.length + queue.preparing.length;
    const deliveredInFilter = orders.filter(
      (order) =>
        (order.status === "delivered" ||
          order.status === "delivered_cash_with_cyclist" ||
          order.status === "cash_transferred_to_vendor") &&
        inKpiWindow(order.createdAt),
    );
    const transferredCashOrders = deliveredInFilter.filter(
      (order) => order.status === "cash_transferred_to_vendor" && order.paymentMethod === "COD",
    );

    const settledCreditMad = Number(carnetQuery.data?.kpis?.settledCreditMad ?? 0);
    const settledCarnetNetProfitMad = roundMoney(
      Number(carnetQuery.data?.kpis?.settledCarnetVendorRevenueMad ?? 0),
    );
    const ledgerPlatformDuesMad = roundMoney(Number(dashboardQuery.data?.vendor?.platformDuesMad ?? 0));

    return {
      pendingOrders,
      completedInFilter: deliveredInFilter.length,
      totalCashInHandMad: roundMoney(
        transferredCashOrders.reduce((sum, order) => sum + Number(order.totalMad ?? 0), 0) + settledCreditMad,
      ),
      myNetProfitMad: roundMoney(
        transferredCashOrders.reduce((sum, order) => sum + Number(order.vendorShareMad ?? 0), 0) +
          settledCarnetNetProfitMad,
      ),
      platformDuesMad: ledgerPlatformDuesMad,
      cashEarningsMad: roundMoney(transferredCashOrders.reduce((sum, order) => sum + Number(order.totalMad ?? 0), 0)),
      creditIssuedMad: roundMoney(0),
      outstandingCreditMad: roundMoney(Number(carnetQuery.data?.kpis?.totalOutstandingCreditMad ?? 0)),
    };
  }, [orders, queue, kpiFilter, carnetQuery.data?.kpis, dashboardQuery.data?.vendor?.platformDuesMad]);

  const printableOrder = useMemo<ThermalReceiptOrder>(
    () =>
      printOrder
        ? {
            id: printOrder.id,
            customerName: printOrder.customerName,
            customerPhone: printOrder.customerPhone,
            specificAddress: typeof printOrder.specificAddress === "string" ? printOrder.specificAddress : null,
            neighborhoodName: printOrder.neighborhoodName,
            communeName: printOrder.communeName,
            specialInstructions: printOrder.deliveryNotes,
            createdAt: printOrder.createdAt,
            items: printOrder.items,
            deliveryFeeMad: Number(printOrder.deliveryFeeMad ?? 0),
            totalMad: printOrder.totalMad,
          }
        : {
            id: "preview",
            customerName: "-",
            customerPhone: "-",
            specificAddress: "-",
            neighborhoodName: "-",
            communeName: "-",
            specialInstructions: "",
            createdAt: new Date().toISOString(),
            items: [],
            deliveryFeeMad: 0,
            totalMad: 0,
          },
    [printOrder],
  );
  const printableSettings = useMemo<ThermalInvoiceSettings>(
    () => ({
      receiptLogoUrl: invoiceSettingsQuery.data?.receipt_logo_url ?? null,
      receiptStoreName:
        invoiceSettingsQuery.data?.receipt_store_name ??
        invoiceSettingsQuery.data?.store_name ??
        DEFAULT_RECEIPT_STORE_NAME,
      receiptSlogan: invoiceSettingsQuery.data?.receipt_slogan ?? DEFAULT_RECEIPT_SLOGAN,
      receiptPhone: invoiceSettingsQuery.data?.receipt_phone ?? invoiceSettingsQuery.data?.phone ?? DEFAULT_RECEIPT_PHONE,
      receiptAddress:
        invoiceSettingsQuery.data?.receipt_address ?? invoiceSettingsQuery.data?.address ?? DEFAULT_RECEIPT_ADDRESS,
      receiptWebsite: invoiceSettingsQuery.data?.receipt_website ?? DEFAULT_RECEIPT_WEBSITE,
      taxId: invoiceSettingsQuery.data?.tax_id ?? null,
      receiptFooterMessage:
        invoiceSettingsQuery.data?.receipt_footer_message ??
        invoiceSettingsQuery.data?.footer_message ??
        DEFAULT_RECEIPT_FOOTER_MESSAGE,
      receiptSocialSupport: invoiceSettingsQuery.data?.receipt_social_support ?? DEFAULT_RECEIPT_SOCIAL_SUPPORT,
    }),
    [invoiceSettingsQuery.data],
  );
  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptPrintRef,
    documentTitle: printOrder ? `receipt-${printOrder.id.slice(0, 8)}` : "thermal-receipt",
    onAfterPrint: () => {
      setPrintOrder(null);
    },
    onPrintError: () => {
      setPrintOrder(null);
      toast.error(t("vendorDashboard.toasts.printFailed"));
    },
  });

  useEffect(() => {
    if (!printOrder || !invoiceSettingsQuery.data) {
      return;
    }

    const timer = window.setTimeout(() => {
      const receiptNode = receiptPrintRef.current;
      if (!receiptNode || !receiptNode.textContent?.trim()) {
      toast.error(t("vendorDashboard.toasts.receiptNotReady"));
        setPrintOrder(null);
        return;
      }

      void handlePrintReceipt();
    }, 140);

    return () => window.clearTimeout(timer);
  }, [handlePrintReceipt, invoiceSettingsQuery.data, printOrder]);
  const selectedCarnetCustomer = useMemo(
    () =>
      (carnetQuery.data?.carnetCustomers ?? []).find(
        (customer) => customer.customerPhone === selectedCarnetPhone,
      ) ?? null,
    [carnetQuery.data?.carnetCustomers, selectedCarnetPhone],
  );
  const ledgerTransactions = useMemo<CarnetLedgerTransaction[]>(
    () => (ledgerQuery.data?.transactions ?? []) as CarnetLedgerTransaction[],
    [ledgerQuery.data?.transactions],
  );

  const ordersById = useMemo(() => {
    return new Map(orders.map((order) => [order.id, order]));
  }, [orders]);

  const inventoryItems = useMemo<InventoryItem[]>(
    () =>
      ((inventoryQuery.data?.products ?? []) as Array<{
        id: string;
        name: string;
        nameFr?: string | null;
        nameAr?: string | null;
        category?: string;
        productVariants?: string[];
        measurementValue?: number | null;
        measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
        imageUrl?: string | null;
        vendorPrice: number;
        isAvailable: boolean;
        isFlashSale?: boolean;
        flashSalePrice?: number | null;
        flashSaleEndTime?: string | null;
      }>).map((item) => ({
        ...item,
        name: getLocalizedValue({ en: item.name, fr: item.nameFr, ar: item.nameAr }, activeLanguage, item.name),
        category: localizeCategoryLabel(item.category) || item.category,
        productVariants: Array.isArray(item.productVariants)
          ? item.productVariants
              .map((variant) => getLocalizedValue(variant, activeLanguage, variant).trim())
              .filter((variant) => variant.length > 0)
          : [],
        measurementUnitLabel: localizeMeasurementUnit(item.measurementUnit),
        isFlashSale: item.isFlashSale ?? false,
        flashSalePrice: item.flashSalePrice ?? null,
        flashSaleEndTime: item.flashSaleEndTime ?? null,
      })),
    [activeLanguage, inventoryQuery.data],
  );

  useEffect(() => {
    if (inventoryItems.length === 0) {
      return;
    }

    setInventoryDraft((current) => {
      const next = { ...current };
      for (const item of inventoryItems) {
        next[item.id] = {
          vendorPrice: current[item.id]?.vendorPrice ?? (item.vendorPrice > 0 ? String(item.vendorPrice) : ""),
          isAvailable: current[item.id]?.isAvailable ?? item.isAvailable,
        };
      }
      return next;
    });

    setFlashDraft((current) => {
      const next = { ...current };
      for (const item of inventoryItems) {
        next[item.id] = {
          enabled: item.isFlashSale,
          price: item.flashSalePrice != null ? String(item.flashSalePrice) : item.vendorPrice > 0 ? String(item.vendorPrice) : "",
          endAt: item.flashSaleEndTime ?? "",
        };
      }
      return next;
    });
  }, [inventoryItems]);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      setIsUpdating(orderId);
      queryClient.setQueryData(["vendor", "dashboard"], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: (current.orders ?? []).map((order: any) =>
            order.id === orderId ? { ...order, status: "preparing" } : order,
          ),
        };
      });

      await updateStatus({ data: { phoneNumber: normalizedVendorPhoneNumber, orderId, nextStatus: "preparing" } });
      await dashboardQuery.refetch();
      toast.success(t("vendorDashboard.toasts.movedToPreparing"));
    } catch (error) {
      console.error("Failed to accept order:", error);
      await dashboardQuery.refetch();
      toast.error(t("vendorDashboard.toasts.updateOrderFailed"));
    } finally {
      setIsUpdating(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      setIsUpdating(orderId);
      const orderForReceipt = orders.find((order) => order.id === orderId) ?? null;
      queryClient.setQueryData(["vendor", "dashboard"], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: (current.orders ?? []).map((order: any) =>
            order.id === orderId ? { ...order, status: "ready" } : order,
          ),
        };
      });

      await updateStatus({ data: { phoneNumber: normalizedVendorPhoneNumber, orderId, nextStatus: "ready" } });
      await dashboardQuery.refetch();
      toast.success(t("vendorDashboard.toasts.markedReady"));

      if (orderForReceipt) {
        setPrintOrder({
          ...orderForReceipt,
          status: "ready",
        });
      }
      return true;
    } catch (error) {
      console.error("Failed to mark order as ready:", error);
      await dashboardQuery.refetch();
      toast.error(t("vendorDashboard.toasts.updateOrderFailed"));
      return false;
    } finally {
      setIsUpdating(null);
    }
  };

  const handleOpenPackingModal = (orderId: string) => {
    const targetOrder = orders.find((order) => order.id === orderId);
    if (!targetOrder || targetOrder.items.length === 0) {
      toast.error(t("vendorDashboard.toasts.noItemsToPack"));
      return;
    }

    setPackingProgressByOrder((current) => {
      if (current[orderId]) return current;

      const initialChecks = targetOrder.items.reduce<Record<string, boolean>>((acc, item, index) => {
        acc[getOrderItemKey(targetOrder.id, item, index)] = false;
        return acc;
      }, {});

      return {
        ...current,
        [orderId]: initialChecks,
      };
    });
    setPackingOrderId(orderId);
  };

  const packingOrder = useMemo(
    () => (packingOrderId ? orders.find((order) => order.id === packingOrderId) ?? null : null),
    [orders, packingOrderId],
  );

  const packedItemsCount = useMemo(() => {
    if (!packingOrder) return 0;
    return packingOrder.items.filter((item, index) => {
      const itemKey = getOrderItemKey(packingOrder.id, item, index);
      return packingProgressByOrder[packingOrder.id]?.[itemKey];
    }).length;
  }, [packingOrder, packingProgressByOrder]);

  const totalPackingItems = packingOrder?.items.length ?? 0;
  const fillPercentage = totalPackingItems > 0 ? Math.round((packedItemsCount / totalPackingItems) * 100) : 0;
  const packingDeadlineLabel = useMemo(() => {
    if (!packingOrder?.createdAt) return "--:--";

    const createdAt = new Date(packingOrder.createdAt);
    if (Number.isNaN(createdAt.getTime())) return "--:--";

    const deadline = new Date(createdAt.getTime() + 30 * 60 * 1000);
    return deadline.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }, [packingOrder?.createdAt]);
  const packingEstimatedWeightKg = useMemo(() => {
    if (!packingOrder) return 0;

    return packingOrder.items.reduce((sum, item) => {
      const quantity = Number(item.quantity ?? 0);
      const measurementValue = Number(item.measurementValue ?? 0);
      const measurementUnit = item.measurementUnit?.trim().toLowerCase() ?? "";

      if (!Number.isFinite(quantity) || !Number.isFinite(measurementValue) || quantity <= 0 || measurementValue <= 0) {
        return sum;
      }

      if (measurementUnit === "kg") {
        return sum + measurementValue * quantity;
      }

      if (measurementUnit === "gram" || measurementUnit === "g") {
        return sum + (measurementValue / 1000) * quantity;
      }

      return sum;
    }, 0);
  }, [packingOrder]);
  const packingBagsCount = useMemo(() => {
    if (!packingOrder || packingOrder.items.length === 0) return 0;
    const estimatedBags = Math.ceil(packingEstimatedWeightKg / 4);
    return Math.max(1, estimatedBags || 1);
  }, [packingEstimatedWeightKg, packingOrder]);
  const packingSubtotalMad = useMemo(() => {
    if (!packingOrder) return 0;

    return roundMoney(
      packingOrder.items.reduce((sum, item) => {
        const unitPrice = Number(item.unitPriceMad ?? 0);
        const quantity = Number((item as { qty?: number }).qty ?? item.quantity ?? 0);

        if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity) || quantity <= 0) {
          return sum;
        }

        return sum + unitPrice * quantity;
      }, 0),
    );
  }, [packingOrder]);
  const packedByName = useMemo(() => {
    if (typeof window === "undefined") {
      return vendorStoreName;
    }

    try {
      const raw = window.localStorage.getItem("bzaf.vendorSession");
      if (!raw) return vendorStoreName;
      const parsed = JSON.parse(raw) as { fullName?: string; ownerName?: string; name?: string };
      return parsed.fullName?.trim() || parsed.ownerName?.trim() || parsed.name?.trim() || vendorStoreName;
    } catch {
      return vendorStoreName;
    }
  }, [vendorStoreName]);
  const isPackingComplete = useMemo(() => {
    if (!packingOrder || packingOrder.items.length === 0) return false;
    return packingOrder.items.every((item, index) => {
      const itemKey = getOrderItemKey(packingOrder.id, item, index);
      return packingProgressByOrder[packingOrder.id]?.[itemKey] === true;
    });
  }, [packingOrder, packingProgressByOrder]);

  const togglePackingItem = (itemKey: string, checked: boolean) => {
    if (!packingOrderId) return;
    setPackingProgressByOrder((current) => ({
      ...current,
      [packingOrderId]: {
        ...(current[packingOrderId] ?? {}),
        [itemKey]: checked,
      },
    }));
  };

  const handleConfirmPackedOrder = async () => {
    if (!packingOrder || !isPackingComplete) return;
    const wasUpdated = await handleMarkReady(packingOrder.id);
    if (wasUpdated) {
      setPackingProgressByOrder((current) => {
        const next = { ...current };
        delete next[packingOrder.id];
        return next;
      });
      setPackingOrderId(null);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    setRejectedOrderIds((current) => ({
      ...current,
      [orderId]: true,
    }));
    toast.success(t("vendorDashboard.toasts.orderRemovedFromQueue"));
  };

  const persistInventoryItem = async (item: InventoryItem, vendorPrice: number, isAvailable: boolean) => {
    try {
      setIsSavingInventoryFor(item.id);
      await saveInventoryItem({
        data: {
          phoneNumber: normalizedVendorPhoneNumber,
          masterProductId: item.id,
          vendorPrice,
          isAvailable,
        },
      });
      await inventoryQuery.refetch();
      toast.success(t("vendorDashboard.toasts.inventoryUpdated"));
    } catch (error) {
      console.error("Failed to save inventory item:", error);
      toast.error(t("vendorDashboard.toasts.saveInventoryFailed"));
    } finally {
      setIsSavingInventoryFor(null);
    }
  };

  const handleSaveInventoryItem = async (item: InventoryItem) => {
    const draft = inventoryDraft[item.id] ?? {
      vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
      isAvailable: item.isAvailable,
    };

    const numericPrice = Number(draft.vendorPrice);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      toast.error(t("vendorDashboard.toasts.enterValidPrice"));
      return;
    }

    await persistInventoryItem(item, numericPrice, draft.isAvailable);
  };

  const handleToggleAvailability = async (item: InventoryItem, checked: boolean) => {
    setInventoryDraft((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? {
          vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
          isAvailable: item.isAvailable,
        }),
        isAvailable: checked,
      },
    }));

    const draftPrice = inventoryDraft[item.id]?.vendorPrice ?? (item.vendorPrice > 0 ? String(item.vendorPrice) : "0");
    const numericPrice = Number(draftPrice);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      toast.error(t("vendorDashboard.toasts.setValidPriceBeforeStockChange"));
      return;
    }

    await persistInventoryItem(item, numericPrice, checked);
  };

  const handleSaveFlashSale = async (item: InventoryItem) => {
    const draft = flashDraft[item.id] ?? {
      enabled: item.isFlashSale,
      price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
      endAt: item.flashSaleEndTime ?? "",
    };

    const numericFlashPrice = Number(draft.price);
    if (draft.enabled) {
      if (Number.isNaN(numericFlashPrice) || numericFlashPrice <= 0) {
        toast.error(t("vendorDashboard.toasts.flashPriceGtZero"));
        return;
      }

      if (numericFlashPrice >= item.vendorPrice) {
        toast.error(t("vendorDashboard.toasts.flashPriceLowerThanRegular"));
        return;
      }

      if (!draft.endAt) {
        toast.error(t("vendorDashboard.toasts.chooseFlashEndTime"));
        return;
      }

      const endTime = new Date(draft.endAt);
      if (Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
        toast.error(t("vendorDashboard.toasts.flashEndTimeFuture"));
        return;
      }
    }

    const activeVendorPhone = (() => {
      if (typeof window === "undefined") return vendorPhoneNumber;
      try {
        const raw = window.localStorage.getItem("bzaf.vendorSession");
        return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? vendorPhoneNumber) : vendorPhoneNumber;
      } catch {
        return vendorPhoneNumber;
      }
    })();
    const normalizedActiveVendorPhone = formatMoroccoPhoneForPayload(
      normalizeMoroccoPhoneInput(activeVendorPhone),
    );

    if (!isValidMoroccoPhone(normalizeMoroccoPhoneInput(activeVendorPhone))) {
      toast.error(t("vendorDashboard.toasts.vendorSessionMissing"));
      return;
    }

    try {
      setIsSavingFlashFor(item.id);
      toast.loading(t("vendorDashboard.toasts.savingFlashSale"), { id: `flash-save-${item.id}` });
      await saveFlashSale({
        data: {
          phoneNumber: normalizedActiveVendorPhone,
          masterProductId: item.id,
          enabled: draft.enabled,
          flashSalePrice: draft.enabled ? numericFlashPrice : null,
          flashSaleEndTime: draft.enabled ? new Date(draft.endAt).toISOString() : null,
        },
      });
      await inventoryQuery.refetch();
      toast.success(
        draft.enabled ? t("vendorDashboard.toasts.flashSaleSaved") : t("vendorDashboard.toasts.flashSaleDisabled"),
        {
          id: `flash-save-${item.id}`,
        },
      );
    } catch (error) {
      console.error("Failed to save flash sale:", error);
      const errorMessage = error instanceof Error ? error.message : t("vendorDashboard.toasts.flashSaleSaveFailed");
      toast.error(errorMessage, { id: `flash-save-${item.id}` });
      await inventoryQuery.refetch();
    } finally {
      setIsSavingFlashFor(null);
    }
  };

  const handleLogout = async () => {
    clearRoleSessions();
    toast.success(t("vendorDashboard.toasts.loggedOut"));
    await navigate({ to: "/vendor/login" });
  };

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Store className="size-5" />
                </span>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{vendorStoreName}</h1>
                  <p className="text-xs text-muted-foreground sm:text-sm">{t("vendorDashboard.header.subtitle")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <LanguageSwitcher className="rounded-xl" />
                <Button
                  size="icon"
                  variant="soft"
                  className="rounded-xl"
                  onClick={handleToggleSounds}
                  aria-label={isSoundEnabled ? t("vendorDashboard.header.disableSounds") : t("vendorDashboard.header.enableSounds")}
                  title={isSoundEnabled ? t("vendorDashboard.header.disableSounds") : t("vendorDashboard.header.enableSounds")}
                >
                  {isSoundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </Button>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    {isOnline ? t("vendorDashboard.header.online") : t("vendorDashboard.header.offline")}
                  </span>
                  <Switch checked={isOnline} onCheckedChange={setIsOnline} />
                </div>
                <Button variant="soft" className="rounded-xl" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  {t("vendorDashboard.header.logout")}
                </Button>
                <Button variant="soft" className="rounded-xl" onClick={() => navigate({ to: "/vendor/wallet" })}>
                  <Wallet className="size-4" />
                  {t("vendorDashboard.header.wallet")}
                </Button>
                <Button variant="default" className="rounded-xl" onClick={() => navigate({ to: "/vendor/wallet" })}>
                  <QrCode className="size-4" />
                  {t("vendorDashboard.header.payAdmin")}
                </Button>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t("vendorDashboard.kpi.period")}</span>
                <select
                  value={kpiFilter}
                  onChange={(event) => setKpiFilter(event.target.value as HistoryFilter)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                >
                  <option value="today">{t("vendorDashboard.filters.today")}</option>
                  <option value="week">{t("vendorDashboard.filters.week")}</option>
                  <option value="month">{t("vendorDashboard.filters.month")}</option>
                  <option value="all">{t("vendorDashboard.filters.all")}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickStatCard label={t("vendorDashboard.kpi.pendingOrders")} value={String(quickStats.pendingOrders)} icon={Clock3} />
              <QuickStatCard
                label={t("vendorDashboard.kpi.cashInHand")}
                value={`${quickStats.totalCashInHandMad.toFixed(2)} MAD`}
                icon={Banknote}
              />
              <QuickStatCard
                label={t("vendorDashboard.kpi.netProfit")}
                value={`${quickStats.myNetProfitMad.toFixed(2)} MAD`}
                tone="success"
                icon={BookUser}
              />
              <QuickStatCard
                label={t("vendorDashboard.kpi.platformDues")}
                value={`${quickStats.platformDuesMad.toFixed(2)} MAD`}
                tone="danger"
                icon={History}
              />
              </div>
            </section>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <ViewSwitcherMobile value={mainView} onChange={setMainView} />

        <div className="mt-4 grid gap-6 md:mt-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
          <aside className="hidden md:block">
            <div className="sticky top-36 space-y-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
              <ViewNavButton
                label={t("vendorDashboard.nav.liveOrders")}
                icon={ShoppingBag}
                active={mainView === "orders"}
                onClick={() => setMainView("orders")}
              />
              <ViewNavButton
                label={t("vendorDashboard.nav.inventory")}
                icon={Package}
                active={mainView === "inventory"}
                onClick={() => setMainView("inventory")}
              />
              <ViewNavButton
                label={t("vendorDashboard.nav.flashSales")}
                icon={Zap}
                active={mainView === "flashSales"}
                onClick={() => setMainView("flashSales")}
              />
              <ViewNavButton
                label={t("vendorDashboard.nav.carnet")}
                icon={BookUser}
                active={mainView === "carnet"}
                onClick={() => setMainView("carnet")}
              />
              <ViewNavButton
                label={t("vendorDashboard.nav.history")}
                icon={History}
                active={mainView === "history"}
                onClick={() => setMainView("history")}
              />
            </div>
          </aside>

          <div>
            {mainView === "orders" ? (
              <LiveOrdersView
                activeTab={activeTab}
                onTabChange={setActiveTab}
                queue={queue}
                isLoading={isDashboardInitialLoading}
                isUpdating={isUpdating}
                onOpenOrder={(orderId) => navigate({ to: "/vendor/order/$orderId", params: { orderId } })}
                onAcceptOrder={handleAcceptOrder}
                onMarkReady={handleOpenPackingModal}
                onRejectOrder={handleRejectOrder}
                timeTick={timeTick}
              />
            ) : mainView === "history" ? (
              <OrderHistoryView
                orders={queue.delivered}
                filter={historyFilter}
                onFilterChange={setHistoryFilter}
                onOpenOrder={(orderId) => navigate({ to: "/vendor/order/$orderId", params: { orderId } })}
              />
            ) : mainView === "carnet" ? (
              <CarnetView
                trustedCustomerPhone={normalizedTrustedCustomerPhone}
                trustedCustomerMaxLimit={trustedCustomerMaxLimit}
                trustedCustomerName={trustedCustomerName}
                trustedCustomerCin={trustedCustomerCin}
                existingCustomerLookup={existingCustomerLookup}
                totalOutstandingCreditMad={Number(carnetQuery.data?.kpis?.totalOutstandingCreditMad ?? 0)}
                creditIssuedTodayMad={Number(carnetQuery.data?.kpis?.creditIssuedTodayMad ?? 0)}
                settledCreditMad={Number(carnetQuery.data?.kpis?.settledCreditMad ?? 0)}
                adminDuesInCarnetMad={Number(carnetQuery.data?.kpis?.adminDuesInCarnetMad ?? 0)}
                onPhoneChange={setTrustedCustomerPhone}
                onMaxLimitChange={setTrustedCustomerMaxLimit}
                onNameChange={setTrustedCustomerName}
                onCinChange={setTrustedCustomerCin}
                customers={carnetQuery.data?.carnetCustomers ?? []}
                isLoading={isCarnetInitialLoading}
                isSavingCarnet={isSavingCarnet}
                onOpenLedger={(customerPhone: string) => {
                  setSelectedCarnetPhone(customerPhone);
                  setLedgerPaymentAmount("");
                }}
                onAddTrustedCustomer={async () => {
                  if (!isTrustedCustomerPhoneValid) {
                    toast.error(t("vendorDashboard.carnet.enterValidCustomerPhone"));
                    return;
                  }

                  const maxLimit = Number(trustedCustomerMaxLimit);
                  if (Number.isNaN(maxLimit) || maxLimit < 0) {
                    toast.error(t("vendorDashboard.carnet.enterValidMaxCreditLimit"));
                    return;
                  }

                  if (existingCustomerLookup?.found === false && trustedCustomerName.trim().length === 0) {
                    toast.error(t("vendorDashboard.carnet.fullNameRequiredForNewCustomer"));
                    return;
                  }

                  if (!/^[A-Za-z0-9-]{4,30}$/.test(trustedCustomerCin.trim())) {
                    toast.error(t("vendorDashboard.carnet.cinValidation"));
                    return;
                  }

                  const existingInCarnet = (carnetQuery.data?.carnetCustomers ?? []).some(
                    (customer) => customer.customerPhone === trustedCustomerFullPhone,
                  );
                  if (existingInCarnet) {
                    toast.error(t("vendorDashboard.carnet.customerAlreadyInCarnet"));
                    return;
                  }

                  try {
                    setIsSavingCarnet(true);

                    const otpPayload = await requestOtp({
                      data: { phoneNumber: trustedCustomerFullPhone },
                    });

                    fetch(OTP_WEBHOOK_URL, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        phoneNumber: otpPayload.phoneNumber,
                        otpCode: otpPayload.otpCode,
                      }),
                    }).catch((error) => {
                      console.error("Vendor carnet OTP webhook trigger failed:", error);
                    });

                    setPendingCarnetPayload({
                      customerPhone: trustedCustomerFullPhone,
                      maxLimit,
                      customerName:
                        existingCustomerLookup?.found === true
                          ? existingCustomerLookup.fullName ?? undefined
                          : trustedCustomerName.trim() || undefined,
                      customerCin: trustedCustomerCin.trim(),
                    });
                    setPhoneForPendingCarnetVerification(trustedCustomerFullPhone);
                    setOtpCodeForCarnetVerification("");
                    setIsCarnetOtpModalOpen(true);
                    toast.success(t("vendorDashboard.carnet.verificationCodeSent"));
                  } catch (error) {
                    console.error("Failed to save trusted customer:", error);
                    toast.error(t("vendorDashboard.carnet.unableToSendVerification"));
                  } finally {
                    setIsSavingCarnet(false);
                  }
                }}
              />
            ) : mainView === "flashSales" ? (
              <FlashSalesView
                items={inventoryItems}
                drafts={flashDraft}
                isLoading={isInventoryInitialLoading}
                isSavingFlashFor={isSavingFlashFor}
                onDraftChange={setFlashDraft}
                onSaveFlash={handleSaveFlashSale}
              />
            ) : (
              <StoreInventoryView
                items={inventoryItems}
                drafts={inventoryDraft}
                isLoading={isInventoryInitialLoading}
                isSavingInventoryFor={isSavingInventoryFor}
                onDraftChange={setInventoryDraft}
                onSave={handleSaveInventoryItem}
                onQuickToggle={handleToggleAvailability}
              />
            )}
          </div>
        </div>
      </section>

      <Dialog open={isCarnetOtpModalOpen} onOpenChange={setIsCarnetOtpModalOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle>{t("vendorDashboard.carnet.confirmWhatsAppVerification")}</DialogTitle>
            <DialogDescription>
              {t("vendorDashboard.carnet.confirmWhatsAppVerificationDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {phoneForPendingCarnetVerification ? (
              <p className="text-xs text-muted-foreground">
                {t("vendorDashboard.carnet.customerLabel")}: {phoneForPendingCarnetVerification}
              </p>
            ) : null}

            <Input
              inputMode="numeric"
              maxLength={4}
              placeholder={t("vendorDashboard.carnet.fourDigitCode")}
              value={otpCodeForCarnetVerification}
              onChange={(event) =>
                setOtpCodeForCarnetVerification(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-10 rounded-xl"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setIsCarnetOtpModalOpen(false);
                setOtpCodeForCarnetVerification("");
              }}
              disabled={isSavingCarnet}
            >
              {t("vendorDashboard.actions.cancel")}
            </Button>
            <Button
              variant="hero"
              className="rounded-xl"
              disabled={otpCodeForCarnetVerification.length !== 4 || isSavingCarnet || !pendingCarnetPayload}
              onClick={async () => {
                if (!pendingCarnetPayload) {
                  return;
                }

                try {
                  setIsSavingCarnet(true);
                  const result = await verifyAndAddTrustedCustomer({
                    data: {
                      customerPhone: pendingCarnetPayload.customerPhone,
                      maxLimit: pendingCarnetPayload.maxLimit,
                      customerName: pendingCarnetPayload.customerName,
                      customerCin: pendingCarnetPayload.customerCin,
                      otpCode: otpCodeForCarnetVerification,
                    },
                  });

                  if (!result.verified) {
                    toast.error(t("vendorDashboard.carnet.invalidVerificationCode"));
                    return;
                  }

                  setTrustedCustomerPhone("");
                  setTrustedCustomerMaxLimit("");
                  setTrustedCustomerName("");
                  setTrustedCustomerCin("");
                  setExistingCustomerLookup(null);
                  setPendingCarnetPayload(null);
                  setPhoneForPendingCarnetVerification(null);
                  setOtpCodeForCarnetVerification("");
                  setIsCarnetOtpModalOpen(false);
                  await carnetQuery.refetch();
                  toast.success(t("vendorDashboard.carnet.trustedCustomerAdded"));
                } catch (error) {
                  console.error("Failed to verify and save trusted customer:", error);
                  toast.error(error instanceof Error ? error.message : t("vendorDashboard.carnet.verifyTrustedCustomerFailed"));
                } finally {
                  setIsSavingCarnet(false);
                }
              }}
            >
              {isSavingCarnet ? t("vendorDashboard.actions.verifying") : t("vendorDashboard.carnet.verifyAndAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={packingOrder !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPackingOrderId(null);
          }
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {`${t("vendorDashboard.packOrder.title")} ${packingOrder ? shortOrderId(packingOrder.id) : ""}`}
            </DialogTitle>
            <DialogDescription>
              {t("vendorDashboard.packOrder.description")}
            </DialogDescription>
            {packingOrder ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-3 py-1.5 text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{packingOrder.customerName}</span>
                  <span className="text-muted-foreground">·</span>
                  <span dir="ltr">{packingOrder.customerPhone || "—"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t("vendorDashboard.packOrder.deadline")} {packingDeadlineLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-foreground">
                  <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("vendorDashboard.packOrder.bagsSummary", { count: packingBagsCount, weight: packingEstimatedWeightKg.toFixed(1) })}
                </span>
              </div>
            ) : null}
          </DialogHeader>

          {packingOrder ? (
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/20 p-3">
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pe-1">
                  {packingOrder.deliveryNotes?.trim() ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 border-l-4 border-l-amber-500">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-900/80">{t("vendorDashboard.packOrder.specialInstruction")}</p>
                      <p className="mt-1 text-base text-amber-900">{packingOrder.deliveryNotes.trim()}</p>
                    </div>
                  ) : null}
                  {packingOrder.items.map((item, index) => {
                  const itemKey = getOrderItemKey(packingOrder.id, item, index);
                  const checked = !!packingProgressByOrder[packingOrder.id]?.[itemKey];

                  return (
                    <label
                      key={itemKey}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border border-border border-l-2 border-l-border bg-card px-4 py-[14px] transition-all duration-200 hover:-translate-y-px hover:bg-muted/30",
                        checked && "opacity-60",
                      )}
                    >
                      <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = fallbackProductImage;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Package className="size-4" aria-hidden="true" />
                            <span className="sr-only">{t("vendorDashboard.packOrder.noProductImage")}</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="space-y-1.5">
                          <p className="truncate text-base font-medium text-foreground">{item.name}</p>
                        {(() => {
                          const normalizedBrand = item.brandName?.trim();
                          const normalizedMeasurement =
                            item.measurementValue != null && Number.isFinite(item.measurementValue) && item.measurementUnit?.trim()
                              ? `${item.measurementValue} ${localizeMeasurementUnit(item.measurementUnit)}`
                              : null;
                          const normalizedVariant = item.selectedVariant?.trim();

                          return (
                            <>
                              <div className="flex items-center gap-2">
                                {normalizedBrand ? (
                                  <span className="inline-flex shrink-0 items-center rounded-md border border-pink-200 bg-pink-50 px-2 py-0.5 text-[11px] font-medium text-pink-700 shadow-sm">
                                    <Tag className="me-1 h-3 w-3 text-pink-500" aria-hidden="true" />
                                    {normalizedBrand}
                                  </span>
                                ) : null}
                                {normalizedMeasurement ? (
                                  <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    <Scale className="me-1 h-3 w-3 text-blue-500" aria-hidden="true" />
                                    <span dir="ltr">{normalizedMeasurement}</span>
                                  </span>
                                ) : null}
                              </div>
                              <p className="truncate text-[12.5px] text-muted-foreground">
                                <span>{Number(item.unitPriceMad ?? 0).toFixed(2)} MAD</span>
                                <span className="mx-1.5">·</span>
                                 <span>{t("vendorDashboard.packOrder.qty", { quantity: item.quantity })}</span>
                                {normalizedVariant ? (
                                  <>
                                    <span className="mx-1.5">·</span>
                                     <span>{t("vendorDashboard.packOrder.variant", { value: normalizedVariant })}</span>
                                  </>
                                ) : null}
                              </p>
                            </>
                          );
                        })()}
                        </div>
                      </div>
                      <Checkbox
                        className="h-6 w-6 self-center"
                        checked={checked}
                        onCheckedChange={(value: boolean | "indeterminate") =>
                          togglePackingItem(itemKey, value === true)
                        }
                        aria-label={t("vendorDashboard.packOrder.markPacked", { name: item.name })}
                      />
                    </label>
                  );
                })}
                </div>
                <div className="pointer-events-none absolute inset-x-3 bottom-3 h-8 rounded-b-lg bg-gradient-to-t from-muted/20 to-transparent" />
              </div>

              <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-muted/10 p-4">
                <div
                  className={cn(
                    "relative mx-auto h-72 w-48 overflow-hidden rounded-[1.5rem_1.5rem_1rem_1rem] border-2 border-border bg-background shadow-sm",
                    isPackingComplete && "border-success shadow-[0_0_24px_hsl(var(--success)/0.45)]",
                  )}
                >
                  <div className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-in-out" style={{ height: `${fillPercentage}%` }}>
                    <div className="absolute inset-0 bg-success/80" />
                    <div className="absolute -top-2 left-0 h-4 w-full rounded-full bg-success/90" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <ShoppingBag className="size-14 text-muted-foreground/40" />
                    <p className="mt-2 text-center text-2xl font-extrabold text-foreground">{fillPercentage}%</p>
                    <p className="text-xs text-muted-foreground">{t("vendorDashboard.packOrder.bagFillProgress")}</p>
                  </div>
                </div>

                <p className="mt-3 text-center text-sm text-muted-foreground">
                  {t("vendorDashboard.packOrder.itemsPacked", { packed: packedItemsCount, total: totalPackingItems })}
                </p>

                <div className="mt-4 space-y-2">
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">{t("vendorDashboard.packOrder.costs")}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {t("vendorDashboard.packOrder.subtotal")}: {packingSubtotalMad.toFixed(2)} MAD
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("vendorDashboard.packOrder.deliveryFee")}: {Number(packingOrder.deliveryFeeMad ?? 0).toFixed(2)} MAD
                    </p>
                    <div className="mt-3 border-t border-border pt-2">
                      <p className="text-base font-bold text-foreground">
                        {t("vendorDashboard.packOrder.grandTotal")}: {(packingSubtotalMad + Number(packingOrder.deliveryFeeMad ?? 0)).toFixed(2)} MAD
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="shrink-0">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t("vendorDashboard.packOrder.packedBy")}: {packedByName}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-border bg-background"
                  onClick={() => {
                    setPackingOrderId(null);
                  }}
                >
                  {t("vendorDashboard.actions.cancel")}
                </Button>
                <Button
                  variant="hero"
                  className={cn(
                    "rounded-full px-4 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted",
                    isPackingComplete && "bg-success text-success-foreground hover:bg-success/90",
                  )}
                  disabled={!isPackingComplete || (packingOrderId ? isUpdating === packingOrderId : false)}
                  onClick={handleConfirmPackedOrder}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {packingOrderId && isUpdating === packingOrderId
                    ? t("vendorDashboard.actions.updating")
                    : t("vendorDashboard.packOrder.confirmAndMarkReady", { packed: packedItemsCount, total: totalPackingItems })}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0">
        <ThermalReceipt ref={receiptPrintRef} order={printableOrder} settings={printableSettings} />
      </div>

      <Dialog
        open={selectedCarnetPhone !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedCarnetPhone(null);
            setLedgerPaymentAmount("");
            setExpandedLedgerOrderIds({});
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle>{t("vendorDashboard.ledger.customerLedger")}</DialogTitle>
            <DialogDescription>
              {t("vendorDashboard.ledger.description")}
            </DialogDescription>
          </DialogHeader>

          {selectedCarnetCustomer ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">{t("vendorDashboard.ledger.customer")}</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerName ?? t("vendorDashboard.ledger.unnamedCustomer")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("vendorDashboard.ledger.phone")}</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("vendorDashboard.carnet.cin")}</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerCin ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("vendorDashboard.ledger.currentDebt")}</p>
                  <p className="text-sm font-semibold text-destructive">{selectedCarnetCustomer.currentDebt.toFixed(2)} MAD</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("vendorDashboard.ledger.maxLimit")}</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.maxLimit.toFixed(2)} MAD</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[240px_auto]">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={t("vendorDashboard.ledger.paymentAmountPlaceholder")}
                  value={ledgerPaymentAmount}
                  onChange={(event) => setLedgerPaymentAmount(event.target.value)}
                  className="h-10 rounded-xl"
                />
                <Button
                  variant="hero"
                  className="h-10 rounded-xl"
                  disabled={isRecordingPayment}
                  onClick={async () => {
                    const amount = Number(ledgerPaymentAmount);
                    if (Number.isNaN(amount) || amount <= 0) {
                      toast.error(t("vendorDashboard.ledger.enterValidPaymentAmount"));
                      return;
                    }

                    try {
                      setIsRecordingPayment(true);
                      await recordCarnetPayment({
                        data: {
                          customerPhone: selectedCarnetCustomer.customerPhone,
                          amountPaid: amount,
                        },
                      });
                      setLedgerPaymentAmount("");
                      await Promise.all([carnetQuery.refetch(), ledgerQuery.refetch()]);
                      toast.success(t("vendorDashboard.ledger.paymentRecorded"));
                    } catch (error) {
                      console.error("Failed to record payment:", error);
                      toast.error(error instanceof Error ? error.message : t("vendorDashboard.ledger.paymentRecordFailed"));
                    } finally {
                      setIsRecordingPayment(false);
                    }
                  }}
                >
                  {isRecordingPayment ? t("vendorDashboard.actions.saving") : t("vendorDashboard.ledger.recordPayment")}
                </Button>
              </div>

              {isLedgerInitialLoading ? (
                <EmptyState label={t("vendorDashboard.ledger.loadingHistory")} />
              ) : ledgerTransactions.length === 0 ? (
                <EmptyState label={t("vendorDashboard.ledger.noTransactions")} />
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("vendorDashboard.ledger.date")}</TableHead>
                        <TableHead>{t("vendorDashboard.ledger.descriptionColumn")}</TableHead>
                        <TableHead className="text-right">{t("vendorDashboard.ledger.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerTransactions.map((transaction) => {
                        const date = formatOrderDateTime(transaction.createdAt);
                        const orderId = transaction.id.startsWith("order:")
                          ? transaction.id.replace("order:", "")
                          : null;
                        const isOrderRow = transaction.kind === "debt" && !!orderId;
                        const isExpanded = !!(orderId && expandedLedgerOrderIds[orderId]);
                        const orderItems = orderId
                          ? (((ordersById.get(orderId)?.items ?? []) as LedgerOrderItem[]).map((item) => ({
                              name: item.name,
                              quantity: Number(item.quantity ?? 0),
                              unitPriceMad: Number(item.unitPriceMad ?? 0),
                            })) as LedgerOrderItem[])
                          : [];
                        const orderDeliveryFeeMad = orderId ? Number(ordersById.get(orderId)?.deliveryFeeMad ?? 0) : 0;

                        return (
                          <Fragment key={transaction.id}>
                            <TableRow
                              className={isOrderRow ? "cursor-pointer" : undefined}
                              onClick={
                                isOrderRow && orderId
                                  ? () => {
                                      setExpandedLedgerOrderIds((prev) => ({
                                        ...prev,
                                        [orderId]: !prev[orderId],
                                      }));
                                    }
                                  : undefined
                              }
                            >
                              <TableCell className="text-xs text-muted-foreground">
                                {date.date} • {date.time}
                              </TableCell>
                              <TableCell className="font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  {isOrderRow ? (
                                    <ChevronDown
                                      className={`size-4 text-muted-foreground transition-transform duration-200 ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                  ) : null}
                                  <span>{transaction.description}</span>
                                </div>
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold ${
                                  transaction.kind === "debt" ? "text-destructive" : "text-success"
                                }`}
                              >
                                {transaction.kind === "debt" ? "+" : "-"}
                                {Number(transaction.amount ?? 0).toFixed(2)} MAD
                              </TableCell>
                            </TableRow>

                            {isOrderRow && orderId ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={3} className="pt-0">
                                  <div
                                    className={`overflow-hidden transition-all duration-300 ${
                                      isExpanded ? "max-h-64 opacity-100 py-2" : "max-h-0 opacity-0"
                                    }`}
                                  >
                                    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                                      {orderItems.length > 0 ? (
                                        <div className="space-y-2">
                                          {orderItems.map((item, itemIndex) => (
                                            <div
                                              key={`${transaction.id}-item-${itemIndex}`}
                                              className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0"
                                            >
                                              <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">
                                                  {item.quantity}x {item.name}
                                                </p>
                                                  <p className="text-xs text-muted-foreground">
                                                   {t("vendorDashboard.ledger.unit")} {item.unitPriceMad.toFixed(2)} MAD
                                                 </p>
                                              </div>
                                                <p className="shrink-0 font-semibold text-foreground">
                                                  {roundMoney(Number(item.quantity ?? 0) * Number(item.unitPriceMad ?? 0)).toFixed(2)} MAD
                                                </p>
                                            </div>
                                          ))}

                                          <div className="border-t border-gray-200 my-2" />

                                          <div className="flex items-center justify-between gap-3 py-1">
                                              <p className="text-gray-500 text-sm">{t("vendorDashboard.ledger.deliveryFeeToCyclist")}</p>
                                            <p className="shrink-0 font-semibold text-foreground">
                                              {orderDeliveryFeeMad.toFixed(2)} MAD
                                            </p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <p>{t("vendorDashboard.ledger.noItemDetails")}</p>
                                          <div className="border-t border-gray-200 my-2" />
                                          <div className="flex items-center justify-between gap-3 py-1">
                                            <p className="text-gray-500 text-sm">{t("vendorDashboard.ledger.deliveryFeeToCyclist")}</p>
                                            <p className="shrink-0 font-semibold text-foreground">
                                              {orderDeliveryFeeMad.toFixed(2)} MAD
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <EmptyState label={t("vendorDashboard.ledger.customerNotFound")} />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ViewSwitcherMobile({ value, onChange }: { value: MainView; onChange: (view: MainView) => void }) {
  const { t } = useTranslation();
  return (
    <div className="md:hidden">
      <div className="grid w-full grid-cols-4 items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
        <Button
          type="button"
          variant={value === "orders" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("orders")}
        >
          <ShoppingBag className="size-4" />
          {t("vendorDashboard.nav.liveOrders")}
        </Button>
        <Button
          type="button"
          variant={value === "history" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("history")}
        >
          <History className="size-4" />
          {t("vendorDashboard.nav.history")}
        </Button>
        <Button
          type="button"
          variant={value === "inventory" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("inventory")}
        >
          <Boxes className="size-4" />
          {t("vendorDashboard.nav.inventory")}
        </Button>
        <Button
          type="button"
          variant={value === "flashSales" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("flashSales")}
        >
          <Zap className="size-4" />
          {t("vendorDashboard.nav.flashSales")}
        </Button>
      </div>
    </div>
  );
}

function ViewNavButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof ShoppingBag;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border-r-4 px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-transparent bg-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function LiveOrdersView({
  activeTab,
  onTabChange,
  queue,
  isLoading,
  isUpdating,
  onOpenOrder,
  onAcceptOrder,
  onMarkReady,
  onRejectOrder,
  timeTick,
}: {
  activeTab: OrderQueueTab;
  onTabChange: (tab: OrderQueueTab) => void;
  queue: {
    pending: DashboardOrder[];
    preparing: DashboardOrder[];
    ready: DashboardOrder[];
    inDelivery: DashboardOrder[];
    delivered: DashboardOrder[];
  };
  isLoading: boolean;
  isUpdating: string | null;
  onOpenOrder: (orderId: string) => void;
  onAcceptOrder: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  timeTick: number;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("vendorDashboard.liveOrders.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("vendorDashboard.liveOrders.subtitle")}</p>
        </div>
        {isLoading ? <span className="text-sm text-muted-foreground">{t("vendorDashboard.common.loading")}</span> : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          v === "pending" || v === "preparing" || v === "ready" || v === "inDelivery"
            ? onTabChange(v)
            : undefined
        }
      >
        <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg">
            {t("vendorDashboard.tabs.pending", { count: queue.pending.length })}
          </TabsTrigger>
          <TabsTrigger value="preparing" className="rounded-lg">
            {t("vendorDashboard.tabs.preparing", { count: queue.preparing.length })}
          </TabsTrigger>
          <TabsTrigger value="ready" className="rounded-lg">
            {t("vendorDashboard.tabs.ready", { count: queue.ready.length })}
          </TabsTrigger>
          <TabsTrigger value="inDelivery" className="rounded-lg">
            {t("vendorDashboard.tabs.inDelivery", { count: queue.inDelivery.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <EmptyState label={t("vendorDashboard.liveOrders.loading")} />
          ) : queue.pending.length === 0 ? (
            <EmptyState label={t("vendorDashboard.liveOrders.emptyPending")} />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {queue.pending.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="pending"
                    isUpdating={isUpdating === order.id}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    onAccept={() => onAcceptOrder(order.id)}
                    onReject={() => onRejectOrder(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preparing" className="mt-4">
          {isLoading ? (
            <EmptyState label={t("vendorDashboard.liveOrders.loading")} />
          ) : queue.preparing.length === 0 ? (
            <EmptyState label={t("vendorDashboard.liveOrders.emptyPreparing")} />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {queue.preparing.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="preparing"
                    isUpdating={isUpdating === order.id}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    onMarkReady={() => onMarkReady(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ready" className="mt-4">
          {isLoading ? (
            <EmptyState label={t("vendorDashboard.liveOrders.loading")} />
          ) : queue.ready.length === 0 ? (
            <EmptyState label={t("vendorDashboard.liveOrders.emptyReady")} />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {queue.ready.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="ready"
                    isUpdating={false}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="inDelivery" className="mt-4">
          {isLoading ? (
            <EmptyState label={t("vendorDashboard.liveOrders.loading")} />
          ) : queue.inDelivery.length === 0 ? (
            <EmptyState label={t("vendorDashboard.liveOrders.emptyInDelivery")} />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {queue.inDelivery.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="inDelivery"
                    isUpdating={false}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

      </Tabs>
    </section>
  );
}

function OrderHistoryView({
  orders,
  filter,
  onFilterChange,
  onOpenOrder,
}: {
  orders: DashboardOrder[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const { t } = useTranslation();
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter === "today") {
        return createdAt >= startOfToday && createdAt <= now;
      }

      if (filter === "week") {
        return createdAt >= startOfWeek && createdAt <= now;
      }

      return createdAt >= startOfMonth && createdAt <= now;
    });
  }, [orders, filter]);

  const summary = useMemo(
    () => ({
      completedOrders: filteredOrders.length,
      totalEarningsMad: roundMoney(filteredOrders.reduce((sum, order) => sum + Number(order.totalMad ?? 0), 0)),
    }),
    [filteredOrders],
  );

  const filterOptions: Array<{ value: HistoryFilter; label: string }> = [
    { value: "today", label: t("vendorDashboard.filters.today") },
    { value: "week", label: t("vendorDashboard.filters.week") },
    { value: "month", label: t("vendorDashboard.filters.month") },
    { value: "all", label: t("vendorDashboard.filters.all") },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("vendorDashboard.history.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("vendorDashboard.history.subtitle")}</p>
        </div>

        <div className="inline-flex items-center rounded-xl border border-border bg-background p-1">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filter === option.value ? "default" : "ghost"}
              className="h-8 rounded-lg px-3 text-xs"
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QuickStatCard label={t("vendorDashboard.history.totalEarnings")} value={`${summary.totalEarningsMad.toFixed(2)} MAD`} icon={Banknote} tone="accent" />
        <QuickStatCard label={t("vendorDashboard.history.completedOrders")} value={String(summary.completedOrders)} icon={CheckCircle2} />
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState label={t("vendorDashboard.history.empty") } />
      ) : (
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                tab="ready"
                compact
                isUpdating={false}
                onOpenDetails={() => onOpenOrder(order.id)}
                timeTick={Date.now()}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CarnetView({
  trustedCustomerPhone,
  trustedCustomerMaxLimit,
  trustedCustomerName,
  trustedCustomerCin,
  existingCustomerLookup,
  totalOutstandingCreditMad,
  creditIssuedTodayMad,
  settledCreditMad,
  adminDuesInCarnetMad,
  onPhoneChange,
  onMaxLimitChange,
  onNameChange,
  onCinChange,
  customers,
  isLoading,
  isSavingCarnet,
  onOpenLedger,
  onAddTrustedCustomer,
}: {
  trustedCustomerPhone: string;
  trustedCustomerMaxLimit: string;
  trustedCustomerName: string;
  trustedCustomerCin: string;
  existingCustomerLookup: { found: boolean; fullName: string | null } | null;
  totalOutstandingCreditMad: number;
  creditIssuedTodayMad: number;
  settledCreditMad: number;
  adminDuesInCarnetMad: number;
  onPhoneChange: (value: string) => void;
  onMaxLimitChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onCinChange: (value: string) => void;
  customers: Array<{
    id: string;
    customerPhone: string;
    currentDebt: number;
    maxLimit: number;
    customerName?: string | null;
    customerCin?: string | null;
    status?: string;
  }>;
  isLoading: boolean;
  isSavingCarnet: boolean;
  onOpenLedger: (customerPhone: string) => void;
  onAddTrustedCustomer: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const showNewCustomerFields = existingCustomerLookup?.found === false;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{t("vendorDashboard.carnet.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("vendorDashboard.carnet.subtitle")}</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("vendorDashboard.carnet.totalOutstandingCredit")}</p>
              <p className="mt-1 text-2xl font-extrabold text-chart-4">{totalOutstandingCreditMad.toFixed(2)} MAD</p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <Wallet className="size-4" />
            </span>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("vendorDashboard.carnet.creditIssuedToday")}</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">{creditIssuedTodayMad.toFixed(2)} MAD</p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <Clock3 className="size-4" />
            </span>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("vendorDashboard.carnet.settledCredit")}</p>
              <p className="mt-1 text-2xl font-extrabold text-success">{settledCreditMad.toFixed(2)} MAD</p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
        </article>

        <article className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("vendorDashboard.carnet.adminDues")}</p>
              <p className="mt-1 text-2xl font-extrabold text-destructive">{adminDuesInCarnetMad.toFixed(2)} MAD</p>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/40 bg-background text-destructive">
              <History className="size-4" />
            </span>
          </div>
        </article>
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-border bg-background p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="flex items-center overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="px-3 text-sm font-medium text-muted-foreground">{t("vendorDashboard.carnet.phonePrefix")}</span>
            <Input
              placeholder={t("vendorDashboard.carnet.customerPhonePlaceholder")}
              inputMode="numeric"
              value={trustedCustomerPhone}
              onChange={(event) => onPhoneChange(normalizeMoroccoPhoneInput(event.target.value))}
              className="h-10 border-0 rounded-none shadow-none focus-visible:ring-0"
            />
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder={t("vendorDashboard.carnet.maxLimitPlaceholder")}
            value={trustedCustomerMaxLimit}
            onChange={(event) => onMaxLimitChange(event.target.value)}
            className="h-10 rounded-xl"
          />
          <Button variant="hero" className="h-10 rounded-xl" onClick={onAddTrustedCustomer} disabled={isSavingCarnet}>
            {isSavingCarnet ? t("vendorDashboard.carnet.sending") : t("vendorDashboard.carnet.verifyAndAddToCarnet")}
          </Button>
        </div>

        {existingCustomerLookup ? (
          existingCustomerLookup.found ? (
            <Badge className="w-fit rounded-lg bg-emerald-500/10 text-emerald-700 border-emerald-200">
              {t("vendorDashboard.carnet.existingCustomer")}: {existingCustomerLookup.fullName ?? t("vendorDashboard.carnet.unnamedCustomer")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit rounded-lg">
              {t("vendorDashboard.carnet.newCustomer")}
            </Badge>
          )
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {showNewCustomerFields ? (
            <Input
              placeholder={t("vendorDashboard.carnet.fullNamePlaceholder")}
              value={trustedCustomerName}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-10 rounded-xl"
            />
          ) : (
            <div className="hidden md:block" />
          )}
          <Input
            placeholder={t("vendorDashboard.carnet.cinPlaceholder")}
            value={trustedCustomerCin}
            onChange={(event) => onCinChange(event.target.value.toUpperCase())}
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <EmptyState label={t("vendorDashboard.carnet.loadingCustomers")} />
      ) : customers.length === 0 ? (
        <EmptyState label={t("vendorDashboard.carnet.emptyCustomers")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <span>{t("vendorDashboard.carnet.tablePhone")}</span>
            <span>{t("vendorDashboard.carnet.tableCurrentDebt")}</span>
            <span>{t("vendorDashboard.carnet.tableMaxLimit")}</span>
          </div>
          <div className="divide-y divide-border">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => onOpenLedger(customer.customerPhone)}
                className="grid w-full grid-cols-[1.2fr_1fr_1fr] items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-muted/40"
              >
                <p className="font-medium text-primary underline-offset-2 hover:underline">{customer.customerPhone}</p>
                <p className="text-foreground">{customer.currentDebt.toFixed(2)} MAD</p>
                <p className="text-foreground">{customer.maxLimit.toFixed(2)} MAD</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StoreInventoryView({
  items,
  drafts,
  isLoading,
  isSavingInventoryFor,
  onDraftChange,
  onSave,
  onQuickToggle,
}: {
  items: InventoryItem[];
  drafts: Record<string, { vendorPrice: string; isAvailable: boolean }>;
  isLoading: boolean;
  isSavingInventoryFor: string | null;
  onDraftChange: Dispatch<SetStateAction<Record<string, { vendorPrice: string; isAvailable: boolean }>>>;
  onSave: (item: InventoryItem) => Promise<void>;
  onQuickToggle: (item: InventoryItem, checked: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "in-stock" | "out-of-stock" | "unpriced">("all");

  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const draft = drafts[item.id] ?? {
        vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
        isAvailable: item.isAvailable,
      };

      const parsedDraftPrice = Number(draft.vendorPrice);
      const effectivePrice = Number.isNaN(parsedDraftPrice) ? 0 : parsedDraftPrice;

      const matchesSearch = !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "in-stock"
            ? draft.isAvailable
            : statusFilter === "out-of-stock"
              ? !draft.isAvailable
              : effectivePrice <= 0;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, drafts, searchTerm, categoryFilter, statusFilter]);

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{t("vendorDashboard.inventory.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("vendorDashboard.inventory.subtitle")}</p>
      </div>

      {isLoading ? (
        <EmptyState label={t("vendorDashboard.inventory.loading")} />
      ) : items.length === 0 ? (
        <EmptyState label={t("vendorDashboard.inventory.empty")} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("vendorDashboard.inventory.searchPlaceholder")}
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">{t("vendorDashboard.inventory.allCategories")}</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "in-stock" | "out-of-stock" | "unpriced")}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">{t("vendorDashboard.inventory.filters.all")}</option>
              <option value="in-stock">{t("vendorDashboard.inventory.filters.inStock")}</option>
              <option value="out-of-stock">{t("vendorDashboard.inventory.filters.outOfStock")}</option>
              <option value="unpriced">{t("vendorDashboard.inventory.filters.unpriced")}</option>
            </select>
          </div>

          <p className="mb-3 text-xs text-muted-foreground">{t("vendorDashboard.inventory.showingProducts", { count: filteredItems.length })}</p>

          {filteredItems.length === 0 ? (
            <EmptyState label={t("vendorDashboard.inventory.noMatchingProducts")} />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredItems.map((item) => {
            const draft = drafts[item.id] ?? {
              vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
              isAvailable: item.isAvailable,
            };

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex aspect-square w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                      <img
                        src={item.imageUrl || fallbackProductImage}
                        alt={`${item.name} product image`}
                        className="h-full w-full object-contain object-center p-1.5"
                        loading="lazy"
                        width={80}
                        height={80}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.category ? (
                          <Badge variant="outline" className="rounded-md">
                            {item.category}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="rounded-md">
                          {item.measurementUnit}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {draft.isAvailable ? t("vendorDashboard.inventory.status.inStock") : t("vendorDashboard.inventory.status.outOfStock")}
                    </span>
                    <Switch checked={draft.isAvailable} onCheckedChange={(checked) => onQuickToggle(item, checked)} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t("vendorDashboard.inventory.yourPrice")}</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.vendorPrice}
                      onChange={(event) =>
                        onDraftChange((current) => ({
                          ...current,
                          [item.id]: {
                            ...(current[item.id] ?? {
                              vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
                              isAvailable: item.isAvailable,
                            }),
                            vendorPrice: event.target.value,
                          },
                        }))
                      }
                      placeholder={t("vendorDashboard.common.pricePlaceholder")}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <Button
                    variant="hero"
                    className="h-10 rounded-xl sm:min-w-28"
                    onClick={() => onSave(item)}
                    disabled={isSavingInventoryFor === item.id}
                  >
                    {isSavingInventoryFor === item.id ? t("vendorDashboard.actions.saving") : t("vendorDashboard.actions.save")}
                  </Button>
                </div>
              </article>
            );
          })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FlashSalesView({
  items,
  drafts,
  isLoading,
  isSavingFlashFor,
  onDraftChange,
  onSaveFlash,
}: {
  items: InventoryItem[];
  drafts: Record<string, { enabled: boolean; price: string; endAt: string }>;
  isLoading: boolean;
  isSavingFlashFor: string | null;
  onDraftChange: Dispatch<SetStateAction<Record<string, { enabled: boolean; price: string; endAt: string }>>>;
  onSaveFlash: (item: InventoryItem) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (!item.isAvailable || item.vendorPrice <= 0) {
        return false;
      }
      return !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
    });
  }, [items, searchTerm]);

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{t("vendorDashboard.flashSales.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("vendorDashboard.flashSales.subtitle")}</p>
      </div>

      {isLoading ? (
        <EmptyState label={t("vendorDashboard.flashSales.loading")} />
      ) : filteredItems.length === 0 ? (
        <EmptyState label={t("vendorDashboard.flashSales.empty")} />
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-border bg-background p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("vendorDashboard.flashSales.searchPlaceholder")}
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredItems.map((item) => {
              const draft = drafts[item.id] ?? {
                enabled: item.isFlashSale,
                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                endAt: item.flashSaleEndTime ?? "",
              };

              const numericFlashPrice = Number(draft.price);
              const isFlashPriceValid =
                draft.enabled &&
                !Number.isNaN(numericFlashPrice) &&
                numericFlashPrice > 0 &&
                numericFlashPrice < item.vendorPrice;
              const isFlashPriceInvalid =
                draft.enabled && draft.price.trim().length > 0 && !Number.isNaN(numericFlashPrice) && numericFlashPrice >= item.vendorPrice;
              const flashEndTime = draft.endAt ? new Date(draft.endAt) : null;
              const isEndAtValid =
                draft.enabled && flashEndTime !== null && !Number.isNaN(flashEndTime.getTime()) && flashEndTime.getTime() > Date.now();
              const canSaveFlashSale = !draft.enabled || (isFlashPriceValid && isEndAtValid);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex aspect-square w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                        <img
                          src={item.imageUrl || fallbackProductImage}
                          alt={`${item.name} product image`}
                          className="h-full w-full object-contain object-center p-1.5"
                          loading="lazy"
                          width={80}
                          height={80}
                        />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("vendorDashboard.flashSales.regularPrice", { price: item.vendorPrice.toFixed(2) })}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
                      <span className="text-xs font-medium text-foreground">{draft.enabled ? t("vendorDashboard.flashSales.active") : t("vendorDashboard.flashSales.inactive")}</span>
                      <Switch
                        checked={draft.enabled}
                        onCheckedChange={(checked) =>
                          onDraftChange((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? {
                                enabled: item.isFlashSale,
                                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                                endAt: item.flashSaleEndTime ?? "",
                              }),
                              enabled: checked,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("vendorDashboard.flashSales.flashPrice")}</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price}
                        onChange={(event) =>
                          onDraftChange((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? {
                                enabled: item.isFlashSale,
                                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                                endAt: item.flashSaleEndTime ?? "",
                              }),
                              price: event.target.value,
                            },
                          }))
                        }
                        placeholder={t("vendorDashboard.common.pricePlaceholder")}
                        className={cn(
                          "h-10 rounded-xl",
                          isFlashPriceInvalid &&
                            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
                        )}
                        disabled={!draft.enabled}
                      />
                      {isFlashPriceInvalid ? (
                        <p className="text-xs text-destructive">{t("vendorDashboard.toasts.flashPriceLowerThanRegular")}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t("vendorDashboard.flashSales.endsAt")}</label>
                      <Input
                        type="datetime-local"
                        value={draft.endAt ? new Date(draft.endAt).toISOString().slice(0, 16) : ""}
                        onChange={(event) =>
                          onDraftChange((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? {
                                enabled: item.isFlashSale,
                                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                                endAt: item.flashSaleEndTime ?? "",
                              }),
                              endAt: event.target.value ? new Date(event.target.value).toISOString() : "",
                            },
                          }))
                        }
                        className="h-10 rounded-xl"
                        disabled={!draft.enabled}
                      />
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    className="mt-3 h-10 w-full rounded-xl"
                    onClick={() => onSaveFlash(item)}
                    disabled={isSavingFlashFor === item.id || !canSaveFlashSale}
                  >
                    {isSavingFlashFor === item.id ? t("vendorDashboard.actions.saving") : t("vendorDashboard.flashSales.save")}
                  </Button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function OrderCard({
  order,
  tab,
  compact = false,
  isUpdating,
  onOpenDetails,
  onAccept,
  onReject,
  onMarkReady,
  timeTick,
}: {
  order: DashboardOrder;
  tab: OrderQueueTab;
  compact?: boolean;
  isUpdating: boolean;
  onOpenDetails?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onMarkReady?: () => void;
  timeTick: number;
}) {
  const { t } = useTranslation();
  const shortId = shortOrderId(order.id);
  const elapsed = elapsedLabel(order.createdAt, timeTick);
  const destination = [order.neighborhoodName, order.communeName].filter(Boolean).join(", ");
  const isInDeliveryTab = tab === "inDelivery";
  const customerOrAreaLabel = order.customerName?.trim() || destination || t("vendorDashboard.common.destinationUnavailable");
  const cyclistNameInitials = order.cyclist?.name
    ? order.cyclist.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "DR";
  const shouldShowDriverBlock = tab === "inDelivery" || (tab === "ready" && !!order.cyclist);
  const isPreparingTab = tab === "preparing";
  const driver = order.cyclist;
  const driverPhoneForCall = driver?.phoneNumber?.trim() ?? "";
  const driverPhoneDigits = driverPhoneForCall.replace(/\D/g, "");
  const driverPhoneForWhatsApp = driverPhoneDigits.startsWith("0")
    ? `212${driverPhoneDigits.slice(1)}`
    : driverPhoneDigits;

  if (compact) {
    return (
      <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{t("vendorDashboard.common.order")} {shortId}</p>
            <p className="mt-1 text-xs text-muted-foreground">{elapsed}</p>
          </div>
          <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">{t("vendorDashboard.status.delivered")}</Badge>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("vendorDashboard.common.customer")}</p>
            <p className="text-sm font-medium text-foreground">{order.customerName}</p>
          </div>
          <p className="text-base font-bold text-primary">{order.totalMad.toFixed(2)} MAD</p>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "flex h-full min-h-[200px] flex-col transition hover:shadow-md",
        isInDeliveryTab
          ? "rounded-2xl border border-[#e5e7eb] border-l-4 border-l-[#16a34a] bg-white p-5 shadow-sm"
          : isPreparingTab
            ? "rounded-2xl border-[0.5px] border-[#e5e7eb] border-t-[3px] border-t-[#f59e0b] bg-white p-4 shadow-sm"
            : "rounded-xl border border-border bg-card p-4 shadow-sm",
      )}
    >
      <div className={cn("flex-1 space-y-2.5", isInDeliveryTab ? "flex flex-col gap-4 space-y-0" : isPreparingTab ? "space-y-3" : "")}> 
        <div
          className={cn(
            "flex w-full items-start justify-between gap-2",
            !isInDeliveryTab && !isPreparingTab ? "mb-3 flex flex-row items-center justify-end gap-2" : "",
          )}
        >
          {isInDeliveryTab ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="inline-flex h-7 items-center gap-2 rounded-full bg-[#dcfce7] px-3 text-xs font-medium text-[#15803d]" dir="rtl">
                <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" />
                <span>{t("vendorDashboard.status.inDelivery")}</span>
              </span>
              <p className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                <span className="max-w-[130px] truncate whitespace-nowrap">{elapsed}</span>
              </p>
            </div>
          ) : isPreparingTab ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-[20px] bg-[#fef9c3] px-[10px] py-[3px] text-[11px] font-medium text-[#b45309]">
                <span className="h-[14px] w-[14px] shrink-0 animate-spin rounded-full border-2 border-[#f59e0b] border-t-transparent" />
                <span>{t("vendorDashboard.status.preparing")}</span>
              </span>
              <p className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{elapsed}</span>
              </p>
            </div>
          ) : (
            <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2">
              <OrderStatusBadge tab={tab} status={order.status} />
              <p className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm">
                <Clock3 className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{elapsed}</span>
              </p>
            </div>
          )}
        </div>

        {isInDeliveryTab ? (
          <>
            <div className="grid w-full grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">{t("vendorDashboard.common.customer")}</p>
                <p className="truncate text-[15px] font-medium text-foreground">{customerOrAreaLabel}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-right text-[11px] uppercase tracking-[0.05em] text-muted-foreground">{t("vendorDashboard.common.total")}</p>
                <p className="whitespace-nowrap text-right text-[15px] font-bold text-[#16a34a]">{order.totalMad.toFixed(2)} MAD</p>
              </div>
            </div>
            <div className="my-0.5 border-t border-dashed border-[#e5e7eb]" />
          </>
        ) : (
          <>
            <div className="flex-1 space-y-2.5">
              {isPreparingTab ? (
                <>
                  <div className="grid w-full grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{t("vendorDashboard.common.order")}</p>
                      <p className="text-lg font-semibold text-foreground">{shortId}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">{t("vendorDashboard.common.total")}</p>
                      <p className="text-lg font-semibold text-[#16a34a]">{order.totalMad.toFixed(2)} MAD</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="inline-flex w-full items-center gap-1.5 text-[12px] text-muted-foreground">
                      <User className="size-3.5 shrink-0 text-[#16a34a]" />
                      <span className="truncate">{order.customerName}</span>
                    </p>

                    <p className="inline-flex w-full items-center gap-1.5 text-[12px] text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0 text-[#16a34a]" />
                      <span className="truncate">{destination || t("vendorDashboard.common.destinationUnavailable")}</span>
                    </p>
                  </div>

                  <div className="border-t-[0.5px] border-dashed border-[#e5e7eb]" />
                </>
              ) : (
                <>
                  <div className="mb-3 flex w-full flex-row items-center justify-between">
                    <p className="text-lg font-bold text-emerald-600">{order.totalMad.toFixed(2)} MAD</p>
                    <p className="text-xl font-extrabold text-gray-900">{shortId}</p>
                  </div>

                  <p className="inline-flex w-full items-center gap-2 text-sm text-foreground">
                    <User className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-semibold">{order.customerName}</span>
                  </p>

                  <p className="inline-flex w-full items-center gap-2 text-sm text-foreground">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                     <span className="truncate">{destination || t("vendorDashboard.common.destinationUnavailable")}</span>
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {shouldShowDriverBlock && driver ? (
          <div
              className={cn(
                "flex items-center justify-between gap-3",
                isInDeliveryTab
                  ? "w-full flex-row items-center justify-between rounded-xl bg-emerald-50 p-3"
                  : "mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3",
              )}
          >
              <div className={cn("flex min-w-0 items-center", isInDeliveryTab ? "flex-row gap-0 overflow-hidden" : "gap-2.5")}>
              <div className="relative shrink-0">
                <Avatar
                  className={cn(
                    "rounded-full",
                    isInDeliveryTab
                        ? "h-10 w-10 shrink-0 rounded-full"
                      : "h-10 w-10 border border-emerald-200",
                  )}
                >
                  <AvatarImage src={driver.avatarUrl ?? undefined} alt={driver.name} />
                    <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                    {cyclistNameInitials || "9"}
                  </AvatarFallback>
                </Avatar>
                {isInDeliveryTab ? (
                  <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md">
                    <Bike className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>

              <div className={cn("min-w-0", isInDeliveryTab ? "mx-2 flex min-w-0 flex-1 flex-col" : "")}>
                <p className={cn("truncate font-semibold", isInDeliveryTab ? "text-sm font-bold text-foreground" : "text-sm text-foreground")} dir={isInDeliveryTab ? "rtl" : undefined}>
                  {driver.name}
                </p>
                <p
                  className={cn(
                    "font-medium text-muted-foreground",
                    isInDeliveryTab ? "truncate text-xs" : "text-[10px] font-bold uppercase tracking-wide text-emerald-600",
                  )}
                  dir={isInDeliveryTab ? "rtl" : undefined}
                >
                  {isInDeliveryTab ? t("vendorDashboard.driver.assignedForDelivery") : t("vendorDashboard.driver.label")}
                </p>
              </div>
            </div>

            {isInDeliveryTab ? (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 shrink-0 rounded-full border-[#16a34a] bg-transparent px-3 text-xs font-medium text-[#16a34a] hover:bg-transparent"
              >
                <a
                  href={driverPhoneForCall ? `tel:${driverPhoneForCall}` : undefined}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t("vendorDashboard.driver.contactAria", { name: driver.name })}
                >
                  <Users className="h-3.5 w-3.5" />
                  {t("vendorDashboard.driver.contact")}
                </a>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {driverPhoneForCall ? (
                  <a
                    href={`tel:${driverPhoneForCall}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                     aria-label={t("vendorDashboard.driver.callAria", { name: driver.name })}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                ) : null}

                {driverPhoneForWhatsApp ? (
                  <a
                    href={`https://wa.me/${driverPhoneForWhatsApp}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-700 shadow-sm transition hover:bg-green-100"
                     aria-label={t("vendorDashboard.driver.whatsappAria", { name: driver.name })}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <Button
        variant="hero"
        className={cn(
          "mt-2 w-full rounded-[16px]",
          isInDeliveryTab
            ? "h-11 rounded-full bg-[#16a34a] text-sm font-medium text-white shadow-none hover:bg-[#15803d]"
            : isPreparingTab
              ? "h-10 rounded-full bg-[#16a34a] text-xs font-medium text-white shadow-none hover:bg-[#15803d]"
            : "h-10 rounded-xl",
        )}
        onClick={onOpenDetails}
      >
        {isInDeliveryTab || isPreparingTab ? <Eye className="mr-1.5 h-4 w-4" /> : null}
        {tab === "ready"
          ? order.cyclist
            ? t("vendorDashboard.actions.viewAndProcess")
            : t("vendorDashboard.actions.assignDriver")
          : t("vendorDashboard.actions.viewAndProcess")}
      </Button>

      {tab === "pending" ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="soft" className="h-10 w-full rounded-xl" onClick={onAccept} disabled={isUpdating}>
            <BadgeCheck className="size-4" />
            {isUpdating ? t("vendorDashboard.actions.updating") : t("vendorDashboard.actions.accept")}
          </Button>
          <Button variant="outline" className="h-10 w-full rounded-xl" onClick={onReject} disabled={isUpdating}>
            {t("vendorDashboard.actions.reject")}
          </Button>
        </div>
      ) : null}

      {tab === "preparing" ? (
        <Button
          variant="outline"
          className="mt-2 h-10 w-full rounded-full border-[#16a34a] bg-transparent text-xs font-medium text-[#16a34a] shadow-none hover:bg-[#dcfce7] hover:text-[#16a34a]"
          onClick={onMarkReady}
          disabled={isUpdating}
        >
          <Truck className="size-4" />
          {isUpdating ? t("vendorDashboard.actions.opening") : t("vendorDashboard.actions.readyForPickup")}
        </Button>
      ) : null}
    </article>
  );
}

function QuickStatCard({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success" | "danger";
  icon: typeof Clock3;
}) {
  return (
    <article
      className={`rounded-xl border px-3 py-2 shadow-sm ${
        tone === "accent"
          ? "border-primary/20 bg-primary/5 text-foreground"
          : tone === "success"
            ? "border-success/30 bg-success/10 text-foreground"
            : tone === "danger"
              ? "border-destructive/30 bg-destructive/10 text-foreground"
              : "border-border bg-card text-foreground"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-foreground">{value}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <AppEmptyState title={label} subtitle={t("vendorDashboard.common.emptyStateSubtitle")} />
  );
}

function OrderStatusBadge({ tab, status }: { tab: OrderQueueTab; status: DashboardOrder["status"] }) {
  const { t } = useTranslation();
  if (tab === "pending") {
    return <Badge className="rounded-md bg-chart-4/15 text-chart-4 hover:bg-chart-4/15">{t("vendorDashboard.status.pending")}</Badge>;
  }

  if (tab === "preparing") {
    return (
      <Badge className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent/20 px-2.5 py-0.5 text-foreground hover:bg-accent/20">
        <Package className="h-3.5 w-3.5 shrink-0" />
        <span>{t("vendorDashboard.status.preparing")}</span>
      </Badge>
    );
  }

  if (tab === "inDelivery") {
    return <Badge className="rounded-md bg-primary/15 text-primary hover:bg-primary/15">{t("vendorDashboard.status.inDelivery")}</Badge>;
  }

  return status === "ready" ? (
    <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">{t("vendorDashboard.status.ready")}</Badge>
  ) : (
    <Badge className="rounded-md bg-primary/15 text-primary hover:bg-primary/15">{t("vendorDashboard.status.active")}</Badge>
  );
}

function shortOrderId(id: string) {
  return `#${id.slice(-4).toUpperCase()}`;
}

function getOrderItemKey(
  orderId: string,
  item: { productId?: string | null; name: string; quantity: number; unitPriceMad: number },
  index: number,
) {
  return `${orderId}:${item.productId || item.name}:${item.quantity}:${item.unitPriceMad}:${index}`;
}

function elapsedLabel(createdAt: string, nowTick: number) {
  if (!Number.isFinite(nowTick)) {
    return "--";
  }

  if (Number.isNaN(new Date(createdAt).getTime())) {
    return "--";
  }

  return formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    includeSeconds: true,
  });
}

function formatOrderDateTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return { date: "--", time: "--" };
  }

  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function summarizeItems(items: Array<{ name: string; quantity: number; unitPriceMad: number }>) {
  if (!items.length) {
    return "No items";
  }

  const names = items.slice(0, 2).map((item) => item.name);
  return items.length > 2 ? `${names.join(", ")}...` : names.join(", ");
}
