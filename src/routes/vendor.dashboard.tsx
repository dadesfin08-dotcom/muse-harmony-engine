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
  PhoneCall,
  Search,
  ShoppingBag,
  Store,
  Truck,
  User,
  Tag,
  Scale,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

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
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { clearRoleSessions } from "@/lib/operational-auth";
import { formatDistanceToNow } from "date-fns";
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

type MainView = "orders" | "history" | "inventory" | "flashSales" | "carnet";
type OrderQueueTab = "new" | "preparing" | "ready" | "inDelivery";
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

function roundMoney(value: number) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

const VENDOR_SOUNDS_STORAGE_KEY = "bzaf.vendorSoundsEnabled";
const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";

const vendorDashboardSearchSchema = z.object({
  tab: fallback(z.enum(["live", "inventory", "flash-sales", "carnet", "history"]), "live").default("live"),
  sub: fallback(z.enum(["new", "preparing", "ready", "inDelivery"]), "new").default("new"),
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
  status: "new" | "preparing" | "ready" | "in_transit" | "delivering" | "delivered";
  deliveryFeeMad: number;
  totalMad: number;
  vendorShareMad: number;
  itemCount: number;
  items: Array<{
    name: string;
    selectedVariant?: string | null;
    quantity: number;
    unitPriceMad: number;
    imageUrl?: string | null;
    brandName?: string | null;
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
  if (status === "picked_up" || status === "in_transit") {
    return "in_transit";
  }

  if (
    status === "new" ||
    status === "preparing" ||
    status === "ready" ||
    status === "delivering" ||
    status === "delivered"
  ) {
    return status;
  }

  return "new";
}

type InventoryItem = {
  id: string;
  name: string;
  category?: "Groceries" | "Vegetables & Fruits" | "Meat & Poultry" | "Bakery & Pastry" | "Dairy & Eggs" | "Drinks & Water" | "Cleaning Supplies";
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
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
      { title: "Vendor Dashboard | Bzaf Fresh" },
      {
        name: "description",
        content: "Vendor operations dashboard for live order fulfillment and inventory control.",
      },
    ],
  }),
  component: VendorDashboardPage,
});

function VendorDashboardPage() {
  const navigate = useNavigate({ from: "/vendor/dashboard" });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<HistoryFilter>("today");
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

  const dashboardQuery = useQuery({
    queryKey: ["vendor", "dashboard"],
    queryFn: () => fetchDashboardData({ data: { phoneNumber: normalizedVendorPhoneNumber } }),
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
    queryKey: ["vendor", "inventory"],
    queryFn: () => fetchInventoryData({ data: { phoneNumber: normalizedVendorPhoneNumber } }),
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
    toast.error("Vendor session invalid. Please log in again.");
    clearRoleSessions();
    void navigate({ to: "/vendor/login" });
  }, [hasValidVendorPhoneSession, navigate]);

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
    const timer = window.setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
        deliveryNotes: row.delivery_notes,
        paymentMethod: row.payment_method,
        status: normalizeVendorLiveStatus(row.status),
        deliveryFeeMad: roundMoney(Number(row.delivery_fee ?? 0)),
        totalMad: roundMoney(Number(row.total_price ?? 0)),
        vendorShareMad: roundMoney(Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0)),
        itemCount: Number(row.item_count ?? 0),
        items: Array.isArray(row.order_items) ? row.order_items : [],
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
  }, [dashboardQuery.data, rejectedOrderIds]);

  const queue = useMemo(
    () => ({
      new: orders.filter((order) => order.status === "new"),
      preparing: orders.filter((order) => order.status === "preparing"),
      ready: orders.filter((order) => order.status === "ready"),
      inDelivery: orders.filter((order) => order.status === "in_transit" || order.status === "delivering"),
      delivered: orders.filter((order) => order.status === "delivered"),
    }),
    [orders],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsSoundEnabled(localStorage.getItem(VENDOR_SOUNDS_STORAGE_KEY) === "1");
  }, []);

  const previousNewOrderIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedNewOrdersRef = useRef(false);

  useEffect(() => {
    const currentNewOrderIds = new Set(queue.new.map((order) => order.id));

    if (!hasInitializedNewOrdersRef.current) {
      previousNewOrderIdsRef.current.clear();
      currentNewOrderIds.forEach((id) => previousNewOrderIdsRef.current.add(id));
      hasInitializedNewOrdersRef.current = true;
      return;
    }

    const hasIncomingNewOrder = Array.from(currentNewOrderIds).some((id) => !previousNewOrderIdsRef.current.has(id));
    previousNewOrderIdsRef.current.clear();
    currentNewOrderIds.forEach((id) => previousNewOrderIdsRef.current.add(id));

    if (!hasIncomingNewOrder || !isSoundEnabled) {
      return;
    }

    void playAlertSound({ enabled: true }).then((played) => {
      if (!played && !hasAudioPermissionHintShown) {
        toast.info("Click the sound icon to allow alerts in your browser.");
        setHasAudioPermissionHintShown(true);
      }
    });
  }, [queue.new, isSoundEnabled, hasAudioPermissionHintShown]);

  const handleToggleSounds = async () => {
    const nextEnabled = !isSoundEnabled;
    setIsSoundEnabled(nextEnabled);

    if (typeof window !== "undefined") {
      localStorage.setItem(VENDOR_SOUNDS_STORAGE_KEY, nextEnabled ? "1" : "0");
    }

    if (!nextEnabled) {
      toast.success("Sounds disabled.");
      return;
    }

    const played = await playAlertSound({ enabled: true });
    if (!played) {
      toast.error("Browser blocked autoplay. Tap again after interacting with the page.");
      return;
    }

    toast.success("Sounds enabled.");
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

    const pendingOrders = queue.new.length + queue.preparing.length;
    const deliveredInFilter = orders.filter(
      (order) =>
        order.status === "delivered" &&
        inKpiWindow(order.createdAt),
    );
    const cashOrders = deliveredInFilter.filter((order) => order.paymentMethod === "COD");
    const carnetOrders = deliveredInFilter.filter((order) => order.paymentMethod === "Carnet");
    const outstandingCreditMad = (carnetQuery.data?.carnetCustomers ?? []).reduce(
      (sum, customer) => sum + Number(customer.currentDebt ?? 0),
      0,
    );

    return {
      pendingOrders,
      completedInFilter: deliveredInFilter.length,
      cashEarningsMad: roundMoney(cashOrders.reduce((sum, order) => sum + Number(order.totalMad ?? 0), 0)),
      creditIssuedMad: roundMoney(carnetOrders.reduce((sum, order) => sum + Number(order.vendorShareMad ?? 0), 0)),
      outstandingCreditMad: roundMoney(outstandingCreditMad),
    };
  }, [orders, queue, kpiFilter, carnetQuery.data?.carnetCustomers]);

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
      toast.error("Failed to open printer dialog.");
    },
  });

  useEffect(() => {
    if (!printOrder || !invoiceSettingsQuery.data) {
      return;
    }

    const timer = window.setTimeout(() => {
      const receiptNode = receiptPrintRef.current;
      if (!receiptNode || !receiptNode.textContent?.trim()) {
        toast.error("Receipt is not ready yet. Please try again.");
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
        category?: "Groceries" | "Vegetables & Fruits" | "Meat & Poultry" | "Bakery & Pastry" | "Dairy & Eggs" | "Drinks & Water" | "Cleaning Supplies";
        measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
        imageUrl?: string | null;
        vendorPrice: number;
        isAvailable: boolean;
        isFlashSale?: boolean;
        flashSalePrice?: number | null;
        flashSaleEndTime?: string | null;
      }>).map((item) => ({
        ...item,
        isFlashSale: item.isFlashSale ?? false,
        flashSalePrice: item.flashSalePrice ?? null,
        flashSaleEndTime: item.flashSaleEndTime ?? null,
      })),
    [inventoryQuery.data],
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
      toast.success("Order moved to preparing.");
    } catch (error) {
      console.error("Failed to accept order:", error);
      await dashboardQuery.refetch();
      toast.error("Failed to update order status.");
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
      toast.success("Order marked as ready.");

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
      toast.error("Failed to update order status.");
      return false;
    } finally {
      setIsUpdating(null);
    }
  };

  const handleOpenPackingModal = (orderId: string) => {
    const targetOrder = orders.find((order) => order.id === orderId);
    if (!targetOrder || targetOrder.items.length === 0) {
      toast.error("This order has no items to pack.");
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
    toast.success("Order removed from your active queue.");
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
      toast.success("Inventory updated.");
    } catch (error) {
      console.error("Failed to save inventory item:", error);
      toast.error("Failed to save inventory item.");
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
      toast.error("Please enter a valid price.");
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
      toast.error("Set a valid price before changing stock status.");
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
        toast.error("Flash sale price must be greater than 0.");
        return;
      }

      if (numericFlashPrice >= item.vendorPrice) {
        toast.error("Flash sale price must be lower than your regular price.");
        return;
      }

      if (!draft.endAt) {
        toast.error("Please choose when the flash sale ends.");
        return;
      }

      const endTime = new Date(draft.endAt);
      if (Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
        toast.error("Flash sale end time must be in the future.");
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
      toast.error("Vendor session missing. Please log in again.");
      return;
    }

    try {
      setIsSavingFlashFor(item.id);
      toast.loading("Saving flash sale...", { id: `flash-save-${item.id}` });
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
      toast.success(draft.enabled ? "Flash sale saved." : "Flash sale disabled.", {
        id: `flash-save-${item.id}`,
      });
    } catch (error) {
      console.error("Failed to save flash sale:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save flash sale.";
      toast.error(errorMessage, { id: `flash-save-${item.id}` });
      await inventoryQuery.refetch();
    } finally {
      setIsSavingFlashFor(null);
    }
  };

  const handleLogout = async () => {
    clearRoleSessions();
    toast.success("Logged out successfully.");
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
                  <p className="text-xs text-muted-foreground sm:text-sm">Vendor Operations Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  size="icon"
                  variant="soft"
                  className="rounded-xl"
                  onClick={handleToggleSounds}
                  aria-label={isSoundEnabled ? "Disable Sounds" : "Enable Sounds"}
                  title={isSoundEnabled ? "Disable Sounds" : "Enable Sounds"}
                >
                  {isSoundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </Button>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                  <span className="text-xs text-muted-foreground sm:text-sm">{isOnline ? "Online" : "Offline"}</span>
                  <Switch checked={isOnline} onCheckedChange={setIsOnline} />
                </div>
                <Button variant="soft" className="rounded-xl" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Logout
                </Button>
                <Button variant="soft" className="rounded-xl" onClick={() => navigate({ to: "/vendor/wallet" })}>
                  <Wallet className="size-4" />
                  Wallet
                </Button>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs font-medium text-muted-foreground">KPI Period</span>
                <select
                  value={kpiFilter}
                  onChange={(event) => setKpiFilter(event.target.value as HistoryFilter)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickStatCard label="Pending Orders" value={String(quickStats.pendingOrders)} icon={Clock3} />
              <QuickStatCard
                label="Cash Sales Volume · مبيعات نقداً"
                value={`${quickStats.cashEarningsMad.toFixed(2)} MAD`}
                tone="accent"
                icon={Banknote}
              />
              <QuickStatCard
                label="Credit Issued · مبيعات الكارني"
                value={`${quickStats.creditIssuedMad.toFixed(2)} MAD`}
                icon={BookUser}
              />
              <QuickStatCard
                label="Outstanding Credit"
                value={`${quickStats.outstandingCreditMad.toFixed(2)} MAD`}
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
                label="Live Orders"
                icon={ShoppingBag}
                active={mainView === "orders"}
                onClick={() => setMainView("orders")}
              />
              <ViewNavButton
                label="Store Inventory"
                icon={Package}
                active={mainView === "inventory"}
                onClick={() => setMainView("inventory")}
              />
              <ViewNavButton
                label="Flash Sales"
                icon={Zap}
                active={mainView === "flashSales"}
                onClick={() => setMainView("flashSales")}
              />
              <ViewNavButton
                label="Carnet (Credit)"
                icon={BookUser}
                active={mainView === "carnet"}
                onClick={() => setMainView("carnet")}
              />
              <ViewNavButton
                label="Order History"
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
                    toast.error("Enter a valid customer phone number.");
                    return;
                  }

                  const maxLimit = Number(trustedCustomerMaxLimit);
                  if (Number.isNaN(maxLimit) || maxLimit < 0) {
                    toast.error("Enter a valid max credit limit.");
                    return;
                  }

                  if (existingCustomerLookup?.found === false && trustedCustomerName.trim().length === 0) {
                    toast.error("Full name is required for new customers.");
                    return;
                  }

                  if (!/^[A-Za-z0-9-]{4,30}$/.test(trustedCustomerCin.trim())) {
                    toast.error("CIN must be 4-30 letters, numbers, or hyphens.");
                    return;
                  }

                  const existingInCarnet = (carnetQuery.data?.carnetCustomers ?? []).some(
                    (customer) => customer.customerPhone === trustedCustomerFullPhone,
                  );
                  if (existingInCarnet) {
                    toast.error("This customer is already in your carnet list.");
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
                    toast.success("Verification code sent to customer WhatsApp.");
                  } catch (error) {
                    console.error("Failed to save trusted customer:", error);
                    toast.error("Unable to send verification code right now.");
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
            <DialogTitle>Confirm WhatsApp Verification</DialogTitle>
            <DialogDescription>
              Averification code has been sent to the customer&apos;s WhatsApp. Enter it below to
              confirm opening their credit account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {phoneForPendingCarnetVerification ? (
              <p className="text-xs text-muted-foreground">Customer: {phoneForPendingCarnetVerification}</p>
            ) : null}

            <Input
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit code"
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
              Cancel
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
                    toast.error("Invalid verification code.");
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
                  toast.success("Trusted customer added to carnet.");
                } catch (error) {
                  console.error("Failed to verify and save trusted customer:", error);
                  toast.error(error instanceof Error ? error.message : "Failed to verify trusted customer.");
                } finally {
                  setIsSavingCarnet(false);
                }
              }}
            >
              {isSavingCarnet ? "Verifying..." : "Verify & Add to Carnet"}
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
        <DialogContent className="w-[96vw] max-w-4xl rounded-2xl border border-border bg-card p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{`Pack Order ${packingOrder ? shortOrderId(packingOrder.id) : ""}`}</DialogTitle>
            <DialogDescription>
              Check every item to fill the bag and unlock the final confirmation.
            </DialogDescription>
          </DialogHeader>

          {packingOrder ? (
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                {packingOrder.items.map((item, index) => {
                  const itemKey = getOrderItemKey(packingOrder.id, item, index);
                  const checked = !!packingProgressByOrder[packingOrder.id]?.[itemKey];

                  return (
                    <label
                      key={itemKey}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all",
                        checked && "opacity-60",
                      )}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
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
                            <span className="sr-only">No product image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                        {(() => {
                          const normalizedBrand = item.brandName?.trim();
                          const normalizedMeasurement =
                            item.measurementValue != null && Number.isFinite(item.measurementValue) && item.measurementUnit?.trim()
                              ? `${item.measurementValue} ${item.measurementUnit.trim()}`
                              : null;
                          const normalizedVariant = item.selectedVariant?.trim();

                          if (!normalizedBrand && !normalizedMeasurement && !normalizedVariant) {
                            return null;
                          }

                          return (
                            <div className="mt-1 flex flex-row items-center gap-2 whitespace-nowrap overflow-hidden">
                              {normalizedBrand ? (
                                <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm">
                                  <Tag className="me-1 h-3 w-3 text-slate-500" aria-hidden="true" />
                                  <span>الماركة: {normalizedBrand}</span>
                                </span>
                              ) : null}
                              {normalizedMeasurement ? (
                                <span className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 shadow-sm">
                                  <Scale className="me-1 h-3 w-3 text-blue-500" aria-hidden="true" />
                                  <span>
                                    الحجم: <span dir="ltr">{normalizedMeasurement}</span>
                                  </span>
                                </span>
                              ) : null}
                              {normalizedVariant ? (
                                <span className="inline-flex shrink-0 items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 shadow-sm">
                                  <Sparkles className="me-1 h-3 w-3 text-violet-500" aria-hidden="true" />
                                  <span>النوع: {normalizedVariant}</span>
                                </span>
                              ) : null}
                            </div>
                          );
                        })()}
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <Checkbox
                        className="h-6 w-6"
                        checked={checked}
                        onCheckedChange={(value: boolean | "indeterminate") =>
                          togglePackingItem(itemKey, value === true)
                        }
                        aria-label={`Mark ${item.name} packed`}
                      />
                    </label>
                  );
                })}
              </div>

              <div className="rounded-xl border border-border bg-muted/10 p-4">
                <div
                  className={cn(
                    "relative mx-auto h-72 w-48 overflow-hidden rounded-[1.5rem_1.5rem_1rem_1rem] border-2 border-dashed border-border bg-background",
                    isPackingComplete && "border-success shadow-[0_0_24px_hsl(var(--success)/0.45)]",
                  )}
                >
                  <div className="absolute inset-x-0 bottom-0 transition-all duration-700 ease-in-out" style={{ height: `${fillPercentage}%` }}>
                    <div className="absolute inset-0 bg-success/80" />
                    <div className="absolute -top-2 left-0 h-4 w-full rounded-full bg-success/90" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <ShoppingBag className="size-14 text-muted-foreground/40" />
                    <p className="mt-2 text-center text-xl font-black text-foreground">{fillPercentage}%</p>
                    <p className="text-xs text-muted-foreground">Bag fill progress</p>
                  </div>
                </div>

                <p className="mt-3 text-center text-sm text-muted-foreground">
                  {packedItemsCount}/{totalPackingItems} items packed
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setPackingOrderId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              className={cn(
                "rounded-xl",
                isPackingComplete && "bg-success text-success-foreground hover:bg-success/90",
              )}
              disabled={!isPackingComplete || (packingOrderId ? isUpdating === packingOrderId : false)}
              onClick={handleConfirmPackedOrder}
            >
              {packingOrderId && isUpdating === packingOrderId ? "Updating..." : "Confirm & Mark Ready"}
            </Button>
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
            <DialogTitle>Customer Ledger</DialogTitle>
            <DialogDescription>
              Detailed credit ledger with all carnet orders and payment events.
            </DialogDescription>
          </DialogHeader>

          {selectedCarnetCustomer ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerName ?? "Unnamed Customer"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CIN</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerCin ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Debt</p>
                  <p className="text-sm font-semibold text-destructive">{selectedCarnetCustomer.currentDebt.toFixed(2)} MAD</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Limit</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.maxLimit.toFixed(2)} MAD</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[240px_auto]">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Payment amount (MAD)"
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
                      toast.error("Enter a valid payment amount.");
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
                      toast.success("Payment recorded successfully.");
                    } catch (error) {
                      console.error("Failed to record payment:", error);
                      toast.error(error instanceof Error ? error.message : "Failed to record payment.");
                    } finally {
                      setIsRecordingPayment(false);
                    }
                  }}
                >
                  {isRecordingPayment ? "Saving..." : "Record Payment"}
                </Button>
              </div>

              {isLedgerInitialLoading ? (
                <EmptyState label="Loading ledger history..." />
              ) : ledgerTransactions.length === 0 ? (
                <EmptyState label="No transactions found for this customer." />
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
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
                                                  Unit: {item.unitPriceMad.toFixed(2)} MAD
                                                </p>
                                              </div>
                                                <p className="shrink-0 font-semibold text-foreground">
                                                  {roundMoney(Number(item.quantity ?? 0) * Number(item.unitPriceMad ?? 0)).toFixed(2)} MAD
                                                </p>
                                            </div>
                                          ))}

                                          <div className="border-t border-gray-200 my-2" />

                                          <div className="flex items-center justify-between gap-3 py-1">
                                            <p className="text-gray-500 text-sm">
                                              Delivery Fee (Paid to Cyclist) / رسوم التوصيل
                                            </p>
                                            <p className="shrink-0 font-semibold text-foreground">
                                              {orderDeliveryFeeMad.toFixed(2)} MAD
                                            </p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <p>No item details available for this order.</p>
                                          <div className="border-t border-gray-200 my-2" />
                                          <div className="flex items-center justify-between gap-3 py-1">
                                            <p className="text-gray-500 text-sm">
                                              Delivery Fee (Paid to Cyclist) / رسوم التوصيل
                                            </p>
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
            <EmptyState label="Customer not found." />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ViewSwitcherMobile({ value, onChange }: { value: MainView; onChange: (view: MainView) => void }) {
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
          Live Orders
        </Button>
        <Button
          type="button"
          variant={value === "history" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("history")}
        >
          <History className="size-4" />
          History
        </Button>
        <Button
          type="button"
          variant={value === "inventory" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("inventory")}
        >
          <Boxes className="size-4" />
          Store Inventory
        </Button>
        <Button
          type="button"
          variant={value === "flashSales" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("flashSales")}
        >
          <Zap className="size-4" />
          Flash Sales
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
    new: DashboardOrder[];
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
  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Live Orders</h2>
          <p className="text-xs text-muted-foreground">Manage urgent orders by operational stage.</p>
        </div>
        {isLoading ? <span className="text-sm text-muted-foreground">Loading...</span> : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          v === "new" || v === "preparing" || v === "ready" || v === "inDelivery"
            ? onTabChange(v)
            : undefined
        }
      >
        <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl">
          <TabsTrigger value="new" className="rounded-lg">
            New ({queue.new.length})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="rounded-lg">
            Preparing ({queue.preparing.length})
          </TabsTrigger>
          <TabsTrigger value="ready" className="rounded-lg">
            Ready ({queue.ready.length})
          </TabsTrigger>
          <TabsTrigger value="inDelivery" className="rounded-lg">
            In Delivery ({queue.inDelivery.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          {isLoading ? (
            <EmptyState label="Loading live orders..." />
          ) : queue.new.length === 0 ? (
            <EmptyState label="No new orders right now." />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {queue.new.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="new"
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
            <EmptyState label="Loading live orders..." />
          ) : queue.preparing.length === 0 ? (
            <EmptyState label="No orders are currently being prepared." />
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
            <EmptyState label="Loading live orders..." />
          ) : queue.ready.length === 0 ? (
            <EmptyState label="No orders waiting for pickup." />
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
            <EmptyState label="Loading live orders..." />
          ) : queue.inDelivery.length === 0 ? (
            <EmptyState label="No orders currently in delivery." />
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
  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter === "today") {
        return createdAt.toDateString() === now.toDateString();
      }

      if (filter === "week") {
        const startOfWeek = new Date(now);
        const dayOffset = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
        startOfWeek.setHours(0, 0, 0, 0);
        return createdAt >= startOfWeek && createdAt <= now;
      }

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
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
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Order History</h2>
          <p className="text-xs text-muted-foreground">Delivered orders and revenue reporting.</p>
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
        <QuickStatCard label="Total Earnings (MAD)" value={`${summary.totalEarningsMad.toFixed(2)} MAD`} icon={Banknote} tone="accent" />
        <QuickStatCard label="Completed Orders" value={String(summary.completedOrders)} icon={CheckCircle2} />
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState label="No delivered orders found for this period." />
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
  const showNewCustomerFields = existingCustomerLookup?.found === false;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Carnet (Credit)</h2>
        <p className="text-xs text-muted-foreground">Manage trusted customers and their credit balances.</p>
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-border bg-background p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="flex items-center overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
            <Input
              placeholder="6XXXXXXXX"
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
            placeholder="Max limit (MAD)"
            value={trustedCustomerMaxLimit}
            onChange={(event) => onMaxLimitChange(event.target.value)}
            className="h-10 rounded-xl"
          />
          <Button variant="hero" className="h-10 rounded-xl" onClick={onAddTrustedCustomer} disabled={isSavingCarnet}>
            {isSavingCarnet ? "Sending..." : "Verify & Add to Carnet"}
          </Button>
        </div>

        {existingCustomerLookup ? (
          existingCustomerLookup.found ? (
            <Badge className="w-fit rounded-lg bg-emerald-500/10 text-emerald-700 border-emerald-200">
              Existing Customer: {existingCustomerLookup.fullName ?? "Unnamed Customer"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit rounded-lg">
              New Customer
            </Badge>
          )
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {showNewCustomerFields ? (
            <Input
              placeholder="Full Name *"
              value={trustedCustomerName}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-10 rounded-xl"
            />
          ) : (
            <div className="hidden md:block" />
          )}
          <Input
            placeholder="CIN / National ID *"
            value={trustedCustomerCin}
            onChange={(event) => onCinChange(event.target.value.toUpperCase())}
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <EmptyState label="Loading carnet customers..." />
      ) : customers.length === 0 ? (
        <EmptyState label="No trusted customers added yet." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <span>Phone</span>
            <span>Current Debt</span>
            <span>Max Limit</span>
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
        <h2 className="text-base font-semibold text-foreground">Store Inventory</h2>
        <p className="text-xs text-muted-foreground">Set your live prices and control product availability instantly.</p>
      </div>

      {isLoading ? (
        <EmptyState label="Loading inventory..." />
      ) : items.length === 0 ? (
        <EmptyState label="No master products available yet." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products by name"
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">All Categories</option>
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
              <option value="all">All</option>
              <option value="in-stock">In Stock</option>
              <option value="out-of-stock">Out of Stock</option>
              <option value="unpriced">Unpriced</option>
            </select>
          </div>

          <p className="mb-3 text-xs text-muted-foreground">Showing {filteredItems.length} products</p>

          {filteredItems.length === 0 ? (
            <EmptyState label="No products found matching your criteria." />
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
                      {draft.isAvailable ? "In Stock" : "Out of Stock"}
                    </span>
                    <Switch checked={draft.isAvailable} onCheckedChange={(checked) => onQuickToggle(item, checked)} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Your Price (MAD)</label>
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
                      placeholder="0.00"
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <Button
                    variant="hero"
                    className="h-10 rounded-xl sm:min-w-28"
                    onClick={() => onSave(item)}
                    disabled={isSavingInventoryFor === item.id}
                  >
                    {isSavingInventoryFor === item.id ? "Saving..." : "Save"}
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
        <h2 className="text-base font-semibold text-foreground">Flash Sales</h2>
        <p className="text-xs text-muted-foreground">Enable limited-time deals to boost conversions.</p>
      </div>

      {isLoading ? (
        <EmptyState label="Loading flash sale products..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState label="No in-stock priced products available for flash sales." />
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-border bg-background p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products by name"
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
                        <p className="mt-1 text-xs text-muted-foreground">Regular: {item.vendorPrice.toFixed(2)} MAD</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
                      <span className="text-xs font-medium text-foreground">{draft.enabled ? "Active" : "Inactive"}</span>
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
                      <label className="text-xs text-muted-foreground">Flash Price (MAD)</label>
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
                        placeholder="0.00"
                        className={cn(
                          "h-10 rounded-xl",
                          isFlashPriceInvalid &&
                            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
                        )}
                        disabled={!draft.enabled}
                      />
                      {isFlashPriceInvalid ? (
                        <p className="text-xs text-destructive">Flash price must be less than the regular price.</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Ends At</label>
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
                    {isSavingFlashFor === item.id ? "Saving..." : "Save Flash Sale"}
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
  const shortId = shortOrderId(order.id);
  const elapsed = elapsedLabel(order.createdAt, timeTick);
  const destination = [order.neighborhoodName, order.communeName].filter(Boolean).join(", ");
  const cyclistNameInitials = order.cyclist?.name
    ? order.cyclist.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "DR";
  const shouldShowDriverBlock = tab === "inDelivery" || (tab === "ready" && !!order.cyclist);

  if (compact) {
    return (
      <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Order {shortId}</p>
            <p className="mt-1 text-xs text-muted-foreground">{elapsed}</p>
          </div>
          <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">Delivered</Badge>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="text-sm font-medium text-foreground">{order.customerName}</p>
          </div>
          <p className="text-base font-bold text-primary">{order.totalMad.toFixed(2)} MAD</p>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xl font-black tracking-tight text-foreground">{shortId}</p>
        <OrderStatusBadge tab={tab} status={order.status} />
      </div>

      <div className="mt-3 space-y-2.5">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Clock3 className="size-4" />
          ⏱ {elapsed}
        </p>

        {shouldShowDriverBlock && order.cyclist ? (
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border border-primary/25">
                  <AvatarImage src={order.cyclist.avatarUrl ?? undefined} alt={order.cyclist.name} />
                  <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                    {cyclistNameInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Bike className="size-3" />
                    Driver Info
                  </p>
                  <p className="text-sm font-semibold text-foreground">الليفرور: {order.cyclist.name}</p>
                </div>
              </div>

              <a
                href={`tel:${order.cyclist.phoneNumber}`}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-background px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
                aria-label={`Call driver ${order.cyclist.name}`}
              >
                <PhoneCall className="size-3" />
                {order.cyclist.phoneNumber}
              </a>
            </div>
          </div>
        ) : null}

        <p className="inline-flex items-center gap-2 text-sm text-foreground">
          <User className="size-4 text-muted-foreground" />
          <span className="font-semibold">{order.customerName}</span>
        </p>

        <p className="inline-flex items-center gap-2 text-sm text-foreground">
          <MapPin className="size-4 text-muted-foreground" />
          <span>{destination || "Destination unavailable"}</span>
        </p>

        <p className="text-lg font-bold text-primary">{order.totalMad.toFixed(2)} MAD</p>
      </div>

      <Button variant="hero" className="mt-4 h-10 w-full rounded-xl" onClick={onOpenDetails}>
        {tab === "ready" ? (order.cyclist ? "View & Process" : "Assign Driver") : "View & Process"}
      </Button>

      {tab === "new" ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="soft" className="h-10 w-full rounded-xl" onClick={onAccept} disabled={isUpdating}>
            <BadgeCheck className="size-4" />
            {isUpdating ? "Updating..." : "Accept"}
          </Button>
          <Button variant="outline" className="h-10 w-full rounded-xl" onClick={onReject} disabled={isUpdating}>
            Reject
          </Button>
        </div>
      ) : null}

      {tab === "preparing" ? (
        <Button
          variant="hero"
          className="mt-2 h-10 w-full rounded-xl"
          onClick={onMarkReady}
          disabled={isUpdating}
        >
          <Truck className="size-4" />
          {isUpdating ? "Opening..." : "Ready for Pickup"}
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
  tone?: "default" | "accent";
  icon: typeof Clock3;
}) {
  return (
    <article
      className={`rounded-xl border px-3 py-2 shadow-sm ${
        tone === "accent"
          ? "border-primary/20 bg-primary/5 text-foreground"
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
  return (
    <AppEmptyState title={label} subtitle="Data will appear here as soon as it becomes available." />
  );
}

function OrderStatusBadge({ tab, status }: { tab: OrderQueueTab; status: DashboardOrder["status"] }) {
  if (tab === "new") {
    return <Badge className="rounded-md bg-chart-4/15 text-chart-4 hover:bg-chart-4/15">New</Badge>;
  }

  if (tab === "preparing") {
    return <Badge className="rounded-md bg-accent/20 text-foreground hover:bg-accent/20">Preparing</Badge>;
  }

  if (tab === "inDelivery") {
    return <Badge className="rounded-md bg-primary/15 text-primary hover:bg-primary/15">In Delivery</Badge>;
  }

  return status === "ready" ? (
    <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">Ready</Badge>
  ) : (
    <Badge className="rounded-md bg-primary/15 text-primary hover:bg-primary/15">Active</Badge>
  );
}

function shortOrderId(id: string) {
  return `#${id.slice(-4).toUpperCase()}`;
}

function getOrderItemKey(
  orderId: string,
  item: { name: string; quantity: number; unitPriceMad: number },
  index: number,
) {
  return `${orderId}:${item.name}:${item.quantity}:${item.unitPriceMad}:${index}`;
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
