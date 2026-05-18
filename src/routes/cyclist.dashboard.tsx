import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bike, Camera, CheckCircle2, ChevronRight, ClipboardList, CreditCard, LayoutGrid, Lock, LogOut, Map, MapPin, MessageCircle, MessageSquareText, Navigation, Package, PackageCheck, PackageOpen, PackageSearch, Phone, PhoneCall, Scale, ShoppingBasket, Tag, Truck, User, Volume2, VolumeX, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  acceptDeliveryRun,
  cancelActiveDeliveryByOrder,
  completeCustomerDeliveryByOrder,
  getCyclistDashboardData,
  setCyclistActiveState,
  settleVendorCashHandover,
  type CyclistOrderCard,
} from "@/lib/cyclists.functions";
import { clearRoleSessions } from "@/lib/operational-auth";
import { playActionSound } from "@/lib/sound-alerts";
import appI18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { FulfillmentSuccessAnimation } from "@/components/FulfillmentSuccessAnimation";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";
const CYCLIST_SOUNDS_STORAGE_KEY = "bzaf.cyclistSoundsEnabled";

type CyclistView = "available" | "active" | "platformPacks";
type CancelReason = "cod_rejection" | "unreachable" | "fake_order";
type CyclistSession = {
  cyclistId: string;
  phoneNumber: string;
  fullName: string;
};

type CyclistDashboardTab = {
  key: CyclistView | "wallet";
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

export const Route = createFileRoute("/cyclist/dashboard")({
  head: () => ({
    meta: [
      { title: appI18n.t("cyclist.dashboardMetaTitle") },
      {
        name: "description",
        content: appI18n.t("cyclist.dashboardMetaDescription"),
      },
    ],
  }),
  component: CyclistDashboardPage,
});

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const tabPanelVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -18 },
};

function CyclistDashboardPage() {
  const { t, i18n: runtimeI18n } = useTranslation();
  const isArabic = (runtimeI18n.resolvedLanguage || runtimeI18n.language || "en") === "ar";
  const navigate = useNavigate({ from: "/cyclist/dashboard" });
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<CyclistView>("available");
  const [isUpdatingOrderId, setIsUpdatingOrderId] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [hasAudioPermissionHintShown, setHasAudioPermissionHintShown] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState(() => runtimeI18n.t("cyclist.readyToScan"));
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [successAnimationVisible, setSuccessAnimationVisible] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState<CyclistOrderCard | null>(null);
  const [cancelOrder, setCancelOrder] = useState<CyclistOrderCard | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>("cod_rejection");
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const previousAvailableRunIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRunsRef = useRef(false);
  const qrScannerRef = useRef<any>(null);
  const isVerifyingCodeRef = useRef(false);
  const hasScannedRef = useRef(false);
  const [session] = useState<CyclistSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = localStorage.getItem(CYCLIST_SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as CyclistSession;
      if (!parsed?.cyclistId || !parsed?.fullName || !parsed?.phoneNumber) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const fetchDashboardData = useServerFn(getCyclistDashboardData);
  const setActiveState = useServerFn(setCyclistActiveState);
  const acceptRun = useServerFn(acceptDeliveryRun);
  const completeCustomerDelivery = useServerFn(completeCustomerDeliveryByOrder);
  const settleVendorHandover = useServerFn(settleVendorCashHandover);
  const cancelDelivery = useServerFn(cancelActiveDeliveryByOrder);

  usePushNotifications({
    enabled: Boolean(session?.cyclistId),
    role: "cyclist",
    userId: session?.cyclistId ?? null,
  });

  const dashboardQuery = useQuery({
    queryKey: ["cyclist", "dashboard", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: () => fetchDashboardData({ data: { cyclistId: session!.cyclistId } }),
    refetchInterval: session?.cyclistId ? 4_000 : false,
    placeholderData: (previousData) => previousData,
  });

  const cyclist = dashboardQuery.data?.cyclist;
  const availableRuns = dashboardQuery.data?.availableRuns ?? [];
  const activeDeliveries = dashboardQuery.data?.activeDeliveries ?? [];
  const pendingSettlements = dashboardQuery.data?.pendingSettlements ?? [];
  const visibilityHints = dashboardQuery.data?.visibilityHints ?? {
    assignedToOtherCyclistCount: 0,
    unsupportedStatusCount: 0,
    unsupportedStatuses: [] as Array<{ status: string; count: number }>,
  };
  const hasActiveDeliveryLock = activeDeliveries.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsSoundEnabled(localStorage.getItem(CYCLIST_SOUNDS_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!isScannerOpen) {
      setScannerStatus(t("cyclist.readyToScan"));
    }
  }, [isScannerOpen, t]);

  useEffect(() => {
    const currentAvailableRunIds = new Set(availableRuns.map((order) => order.id));

    if (!hasInitializedRunsRef.current) {
      previousAvailableRunIdsRef.current.clear();
      currentAvailableRunIds.forEach((id) => previousAvailableRunIdsRef.current.add(id));
      hasInitializedRunsRef.current = true;
      return;
    }

    const hasNewReadyRun = Array.from(currentAvailableRunIds).some(
      (id) => !previousAvailableRunIdsRef.current.has(id),
    );
    previousAvailableRunIdsRef.current.clear();
    currentAvailableRunIds.forEach((id) => previousAvailableRunIdsRef.current.add(id));

    if (!hasNewReadyRun || !isSoundEnabled) {
      return;
    }

    void playActionSound({ enabled: true }).then((played) => {
      if (!played && !hasAudioPermissionHintShown) {
        toast.info(t("cyclist.soundPermissionHint"));
        setHasAudioPermissionHintShown(true);
      }
    });
  }, [availableRuns, isSoundEnabled, hasAudioPermissionHintShown]);

  const handleToggleSounds = async () => {
    const nextEnabled = !isSoundEnabled;
    setIsSoundEnabled(nextEnabled);

    if (typeof window !== "undefined") {
      localStorage.setItem(CYCLIST_SOUNDS_STORAGE_KEY, nextEnabled ? "1" : "0");
    }

    if (!nextEnabled) {
      toast.success(t("cyclist.soundsDisabled"));
      return;
    }

    const played = await playActionSound({ enabled: true });
    if (!played) {
      toast.error(t("cyclist.autoplayBlocked"));
      return;
    }

    toast.success(t("cyclist.soundsEnabled"));
  };

  const activeDeliveryIds = useMemo(() => new Set(activeDeliveries.map((order) => order.id)), [activeDeliveries]);
  const availableMarketplaceRuns = useMemo(
    () => availableRuns.filter((order) => order.orderCategory !== "PLATFORM_SUBSCRIPTION"),
    [availableRuns],
  );
  const activeMarketplaceDeliveries = useMemo(
    () => activeDeliveries.filter((order) => order.orderCategory !== "PLATFORM_SUBSCRIPTION"),
    [activeDeliveries],
  );
  const platformPackDeliveries = useMemo(
    () => [...availableRuns, ...activeDeliveries].filter((order) => order.orderCategory === "PLATFORM_SUBSCRIPTION"),
    [availableRuns, activeDeliveries],
  );

  const onlineCountLabel = useMemo(() => {
    if (activeView === "available") {
      return t("cyclist.availableRunsCount", { count: availableMarketplaceRuns.length });
    }
    if (activeView === "platformPacks") {
      return t("cyclist.platformPackTasksCount", { count: platformPackDeliveries.length });
    }
    return t("cyclist.activeDeliveriesCount", { count: activeMarketplaceDeliveries.length });
  }, [
    activeView,
    availableMarketplaceRuns.length,
    platformPackDeliveries.length,
    activeMarketplaceDeliveries.length,
    t,
  ]);

  const dashboardTabs = useMemo<CyclistDashboardTab[]>(
    () => [
      {
        key: "available" as const,
        label: t("cyclist.availableRunsTab"),
        icon: LayoutGrid,
        onClick: () => {
          setActiveView("available");
        },
      },
      {
        key: "active" as const,
        label: t("cyclist.activeDeliveriesTab"),
        icon: Navigation,
        onClick: () => {
          setActiveView("active");
        },
      },
      {
        key: "platformPacks" as const,
        label: t("cyclist.platformPacksTab"),
        icon: PackageCheck,
        onClick: () => {
          setActiveView("platformPacks");
        },
      },
      {
        key: "wallet" as const,
        label: t("cyclist.earningsTab"),
        icon: Wallet,
        onClick: () => void navigate({ to: "/cyclist/wallet" }),
      },
    ],
    [navigate, t],
  );

  const orderedDashboardTabs = isArabic ? [...dashboardTabs].reverse() : dashboardTabs;

  const updateOnlineState = async (isOnline: boolean) => {
    if (!cyclist?.id) {
      return;
    }

    try {
      queryClient.setQueryData(["cyclist", "dashboard", session?.cyclistId ?? null], (current: any) =>
        current
          ? {
              ...current,
              cyclist: {
                ...current.cyclist,
                isActive: isOnline,
              },
            }
          : current,
      );

      await setActiveState({ data: { cyclistId: cyclist.id, isActive: isOnline } });
      toast.success(isOnline ? t("cyclist.onlineStateUpdatedOn") : t("cyclist.onlineStateUpdatedOff"));
    } catch (error) {
      console.error("Failed to update cyclist online state:", error);
      await dashboardQuery.refetch();
      toast.error(t("cyclist.onlineStateFailed"));
    }
  };

  const handleAcceptDelivery = async (order: CyclistOrderCard) => {
    if (!session?.cyclistId) {
      return;
    }

    setIsUpdatingOrderId(order.id);
    try {
      queryClient.setQueryData(["cyclist", "dashboard", session.cyclistId], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          availableRuns: (current.availableRuns as CyclistOrderCard[]).filter((run) => run.id !== order.id),
          activeDeliveries: [order, ...(current.activeDeliveries as CyclistOrderCard[])],
        };
      });

      await acceptRun({ data: { cyclistId: session.cyclistId, orderId: order.id } });
      toast.success(t("cyclist.deliveryAccepted"));
      await dashboardQuery.refetch();
    } catch (error) {
      console.error("Failed to accept delivery:", error);
      await dashboardQuery.refetch();
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const isStaleTransitionError =
        errorMessage.includes("invalid status transition") ||
        errorMessage.includes("order status changed") ||
        errorMessage.includes("not an active delivery");

      if (isStaleTransitionError) {
        toast.info("Order status changed", {
          description: "This order was updated by another user. Refreshing...",
        });
      } else {
        toast.error(error instanceof Error ? error.message : t("cyclist.failedAccept"));
      }
    } finally {
      setIsUpdatingOrderId(null);
    }
  };

  const closeScanner = () => {
    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;
    if (scanner) {
      void scanner
        .stop()
        .catch(() => undefined)
        .finally(() => {
          void scanner.clear().catch(() => undefined);
        });
    }
    setIsScannerOpen(false);
    setScannerStatus(t("cyclist.readyToScan"));
    setScannerPaused(false);
    setIsProcessing(false);
    isVerifyingCodeRef.current = false;
    hasScannedRef.current = false;
  };

  const handleCyclistQrScan = async (rawValue: string) => {
    if (!session?.cyclistId || isVerifyingCodeRef.current || hasScannedRef.current) {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawValue);
    } catch {
      toast.error(t("cyclist.invalidQr"));
      return;
    }

    const parsed = payload as { action?: string; order_id?: string; vendor_id?: string };
    const action = String(parsed.action ?? "").trim();
    let orderIdForStateCheck: string | null = null;

    isVerifyingCodeRef.current = true;
    setScannerStatus(t("cyclist.scannerVerifying"));

    try {
      if (action === "customer_delivery") {
        const orderId = String(parsed.order_id ?? "").trim();
        if (!orderId) {
          throw new Error(t("cyclist.invalidQr"));
        }
        orderIdForStateCheck = orderId;

        hasScannedRef.current = true;
        const scanner = qrScannerRef.current;
        qrScannerRef.current = null;
        if (scanner) {
          await scanner.stop().catch(() => undefined);
          await scanner.clear().catch(() => undefined);
        }
        setIsUpdatingOrderId(orderId);
        const completionResult = await completeCustomerDelivery({ data: { cyclistId: session.cyclistId, orderId } });
        toast.success(
          completionResult.nextStatus === "delivered_cash_with_cyclist"
            ? t("cyclist.deliveryCompletedCash")
            : t("cyclist.deliveryCompleted"),
        );
      } else if (action === "vendor_handover") {
        const vendorId = String(parsed.vendor_id ?? "").trim();
        if (!vendorId) {
          throw new Error(t("cyclist.invalidQr"));
        }

        hasScannedRef.current = true;
        const scanner = qrScannerRef.current;
        qrScannerRef.current = null;
        if (scanner) {
          await scanner.stop().catch(() => undefined);
          await scanner.clear().catch(() => undefined);
        }
        setIsUpdatingOrderId(`vendor:${vendorId}`);
        await settleVendorHandover({ data: { cyclistId: session.cyclistId, vendorId } });
        toast.success(t("cyclist.settlementCompleted"));
      } else {
        throw new Error(t("cyclist.invalidQr"));
      }

      setIsScannerSuccess(true);
      setScannerStatus(t("cyclist.scannerVerified"));
      await Promise.all([
        dashboardQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet", session.cyclistId] }),
        queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vendor", "wallet"] }),
      ]);
      window.setTimeout(() => closeScanner(), 900);
    } catch (error) {
      console.error("Cyclist scanner state-machine failed:", error);
      const refetchResult = await dashboardQuery.refetch();

      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const isStaleTransitionError =
        errorMessage.includes("order is not an active delivery") ||
        errorMessage.includes("invalid status transition") ||
        errorMessage.includes("order status changed");

      const refreshedActiveIds = new Set((refetchResult.data?.activeDeliveries ?? []).map((order) => order.id));
      if (orderIdForStateCheck && isStaleTransitionError && !refreshedActiveIds.has(orderIdForStateCheck)) {
        toast.success(t("cyclist.deliveryCompleted"));
        setIsScannerSuccess(true);
        setScannerStatus(t("cyclist.scannerVerified"));
        window.setTimeout(() => closeScanner(), 900);
        return;
      }

      setScannerStatus(t("cyclist.scannerFailed"));
      toast.error(error instanceof Error ? error.message : t("cyclist.invalidQr"));
      isVerifyingCodeRef.current = false;
      hasScannedRef.current = false;
    } finally {
      setIsUpdatingOrderId(null);
    }
  };

  const openScanner = () => {
    setIsScannerSuccess(false);
    setScannerStatus(t("cyclist.cameraPreparing"));
    isVerifyingCodeRef.current = false;
    hasScannedRef.current = false;
    setIsScannerOpen(true);
  };

  const openCancelDialog = (order: CyclistOrderCard) => {
    setCancelOrder(order);
    setCancelReason("cod_rejection");
  };

  const closeCancelDialog = () => {
    if (isCancellingOrder) {
      return;
    }

    setCancelOrder(null);
    setCancelReason("cod_rejection");
  };

  const handleConfirmCancel = async () => {
    if (!session?.cyclistId || !cancelOrder || isCancellingOrder) {
      return;
    }

    setIsCancellingOrder(true);
    setIsUpdatingOrderId(cancelOrder.id);

    try {
      await cancelDelivery({
        data: {
          cyclistId: session.cyclistId,
          orderId: cancelOrder.id,
          reason: cancelReason,
        },
      });

      toast.success(t("cyclist.cancelSuccess"));
      setCancelOrder(null);
      setCancelReason("cod_rejection");
      setActiveView("available");

      await Promise.all([
        dashboardQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["cyclist", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["live-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "customers"] }),
      ]);
    } catch (error) {
      console.error("Failed to cancel active delivery:", error);
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const isStaleTransitionError =
        errorMessage.includes("invalid status transition") ||
        errorMessage.includes("order status changed") ||
        errorMessage.includes("order is not an active delivery");

      if (isStaleTransitionError) {
        toast.info("Order status changed", {
          description: "This order was updated by another user. Refreshing...",
        });
        await dashboardQuery.refetch();
      } else {
        toast.error(error instanceof Error ? error.message : t("cyclist.cancelFailed"));
      }
    } finally {
      setIsCancellingOrder(false);
      setIsUpdatingOrderId(null);
    }
  };

  useEffect(() => {
    if (!isScannerOpen || isScannerSuccess) {
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!mounted) {
          return;
        }

        const scanner = new Html5Qrcode("delivery-qr-reader");
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            void handleCyclistQrScan(decodedText);
          },
          () => undefined,
        );

        if (mounted) {
          setScannerStatus(t("cyclist.cameraPointToQr"));
        }
      } catch (error) {
        console.error("QR camera permission/start failed:", error);
        if (mounted) setScannerStatus(t("cyclist.cameraUnavailableManual"));
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      const scanner = qrScannerRef.current;
      qrScannerRef.current = null;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            void scanner.clear().catch(() => undefined);
          });
      }
    };
  }, [isScannerOpen, isScannerSuccess]);

  const handleLogout = async () => {
    clearRoleSessions();
    localStorage.removeItem(CYCLIST_SESSION_STORAGE_KEY);
    toast.success(t("cyclist.loggedOut"));
    await navigate({ to: "/cyclist/login" });
  };

  if (!session?.cyclistId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("cyclist.sessionExpired")}</p>
          <Button className="w-full" onClick={() => navigate({ to: "/cyclist/login" })}>
            {t("cyclist.goToLogin")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Bike className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{cyclist?.fullName ?? session.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{t("cyclist.dashboardTitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              size="icon"
              variant="soft"
              className="rounded-xl"
              onClick={handleToggleSounds}
              aria-label={isSoundEnabled ? t("cyclist.disableSoundsAria") : t("cyclist.enableSoundsAria")}
              title={isSoundEnabled ? t("cyclist.disableSoundsAria") : t("cyclist.enableSoundsAria")}
            >
              {isSoundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            <Button size="icon" variant="soft" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-lg items-center justify-between rounded-xl border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                cyclist?.isActive ? "animate-pulse bg-success" : "bg-muted-foreground/40",
              )}
            />
            {cyclist?.isActive ? t("cyclist.online") : t("cyclist.offline")}
          </span>
          <Switch checked={Boolean(cyclist?.isActive)} onCheckedChange={updateOnlineState} />
        </div>
      </header>

      <section className="mx-auto w-full max-w-lg px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{onlineCountLabel}</p>
          {dashboardQuery.isLoading ? <p className="text-xs text-muted-foreground">{t("cyclist.refreshing")}</p> : null}
        </div>

        <section className="mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("cyclist.pendingSettlementsTitle")}</p>
          </div>
          {pendingSettlements.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("cyclist.noPendingSettlements")}</p>
          ) : (
            <div className="space-y-2">
              {pendingSettlements.map((settlement) => (
                <div key={settlement.vendorId} className="rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{settlement.vendorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("cyclist.settlementOrdersCount", { count: settlement.ordersCount })} · {settlement.cashToHandoverMad.toFixed(2)} MAD
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("cyclist.settlementScannerHint")}
                  </p>
                </div>
              ))}
              <Button className="w-full active:scale-95" onClick={() => openScanner()} disabled={isUpdatingOrderId !== null}>
                <Camera className="size-4" />
                {t("cyclist.openUniversalScanner")}
              </Button>
            </div>
          )}
        </section>

        <AnimatePresence mode="wait" initial={false}>
          {activeView === "available" ? (
            <motion.div
              key="cyclist-view-available"
              variants={tabPanelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <motion.div className="space-y-3" variants={listVariants} initial="hidden" animate="visible">
            {hasActiveDeliveryLock ? (
              <AppEmptyState
                title={t("cyclist.lockTitle")}
                subtitle={t("cyclist.lockSubtitle")}
                icon={Lock}
                  className="border-border/70 bg-card"
              />
            ) : availableMarketplaceRuns.length === 0 ? (
              <EmptyState
                label={t("cyclist.noReadyDeliveries")}
                hints={[
                  visibilityHints.assignedToOtherCyclistCount > 0
                    ? t("cyclist.hiddenAssignedOther", { count: visibilityHints.assignedToOtherCyclistCount })
                    : null,
                  visibilityHints.unsupportedStatusCount > 0
                    ? t("cyclist.hiddenUnsupportedStatus", { count: visibilityHints.unsupportedStatusCount })
                    : null,
                  ...visibilityHints.unsupportedStatuses.map(({ status, count }) =>
                    t("cyclist.hiddenUnsupportedStatusByType", {
                      count,
                      status: t(`cyclist.statusLabel.${status}`, { defaultValue: status }),
                    }),
                  ),
                ].filter((value): value is string => Boolean(value))}
              />
            ) : (
              availableMarketplaceRuns.map((order) => (
                  <motion.div key={order.id} variants={listItemVariants}>
                    <OrderCard
                      order={order}
                      isActiveDelivery={false}
                      actionLabel={t("cyclist.acceptPickup")}
                      actionTone="primary"
                      actionIcon={Truck}
                      isBusy={isUpdatingOrderId === order.id}
                      onAction={() => handleAcceptDelivery(order)}
                    />
                  </motion.div>
              ))
            )}
              </motion.div>
            </motion.div>
          ) : activeView === "active" ? (
            <motion.div
              key="cyclist-view-active"
              variants={tabPanelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <motion.div className="space-y-3" variants={listVariants} initial="hidden" animate="visible">
            {activeMarketplaceDeliveries.length === 0 ? (
              <EmptyState label={t("cyclist.noActiveDeliveries")} />
            ) : (
              activeMarketplaceDeliveries.map((order) => (
                <motion.div key={order.id} variants={listItemVariants}>
                  <OrderCard
                    order={order}
                    isActiveDelivery
                    actionLabel={t("cyclist.scanToDeliver")}
                    actionTone="success"
                    actionIcon={Camera}
                    isBusy={isUpdatingOrderId === order.id}
                    onOpenDetails={() => setDetailsOrder(order)}
                    onAction={() => openScanner()}
                    onCancel={() => openCancelDialog(order)}
                  />
                </motion.div>
              ))
            )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="cyclist-view-platform-packs"
              variants={tabPanelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <motion.div className="space-y-3" variants={listVariants} initial="hidden" animate="visible">
            {platformPackDeliveries.length === 0 ? (
              <EmptyState label={t("cyclist.noPlatformPackTasks")} />
            ) : (
              platformPackDeliveries.map((order) => {
                const isActiveTask = activeDeliveryIds.has(order.id);
                return (
                  <motion.div key={order.id} variants={listItemVariants}>
                    <PlatformPackOrderCard
                      order={order}
                      isActiveDelivery={isActiveTask}
                      isBusy={isUpdatingOrderId === order.id}
                      onAccept={() => handleAcceptDelivery(order)}
                      onDeliver={() => openScanner()}
                    />
                  </motion.div>
                );
              })
            )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <Dialog open={Boolean(cancelOrder)} onOpenChange={(open) => (!open ? closeCancelDialog() : undefined)}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cyclist.cancelReasonTitle")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={cancelReason} onValueChange={(value) => setCancelReason(value as CancelReason)}>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem id="cancel-reason-cod" value="cod_rejection" className="mt-0.5" />
                <Label htmlFor="cancel-reason-cod" className="cursor-pointer leading-snug">
                  {t("cyclist.cancelReasons.codRejection")}
                </Label>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem id="cancel-reason-unreachable" value="unreachable" className="mt-0.5" />
                <Label htmlFor="cancel-reason-unreachable" className="cursor-pointer leading-snug">
                  {t("cyclist.cancelReasons.unreachable")}
                </Label>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <RadioGroupItem id="cancel-reason-fake" value="fake_order" className="mt-0.5" />
                <Label htmlFor="cancel-reason-fake" className="cursor-pointer leading-snug">
                  {t("cyclist.cancelReasons.fakeOrder")}
                </Label>
              </div>
            </RadioGroup>

            <div className={cn("flex gap-2", isArabic ? "flex-row-reverse" : "flex-row")}>
              <Button variant="outline" className="flex-1" onClick={closeCancelDialog} disabled={isCancellingOrder}>
                {t("cyclist.cancelDialogClose")}
              </Button>
              <Button className="flex-1" onClick={handleConfirmCancel} disabled={isCancellingOrder}>
                {isCancellingOrder ? t("cyclist.refreshing") : t("cyclist.cancelConfirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isScannerOpen} onOpenChange={(open) => (!open ? closeScanner() : undefined)}>
        <DialogContent className="h-[92vh] w-[96vw] max-w-lg overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-base font-semibold">{t("cyclist.scannerTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex h-full flex-col gap-3 p-4">
            {isScannerSuccess ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-10" />
                </span>
                <p className="mt-4 text-lg font-semibold text-foreground">{t("cyclist.deliveryVerifiedTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("cyclist.deliveryVerifiedSubtitle")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-border bg-black/90 p-2">
                  <div id="delivery-qr-reader" className="min-h-[340px] w-full" />
                </div>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">{scannerStatus}</p>
          </div>
        </DialogContent>
      </Dialog>

      <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 py-2 pb-safe">
        <div className="mx-auto w-full max-w-lg rounded-3xl border border-border/70 bg-card/85 px-2 py-2 shadow-sm backdrop-blur-xl">
          <div
            className="w-full flex flex-row items-center justify-start overflow-x-auto gap-2 px-2 py-2 flex-nowrap scrollbar-hide"
            dir={isArabic ? "rtl" : "ltr"}
          >

            {orderedDashboardTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isTabActive = activeView === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={tab.onClick}
                  aria-label={tab.label}
                  className={cn(
                    "relative z-10 flex min-h-14 shrink-0 flex-shrink-0 whitespace-nowrap flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-semibold transition-all duration-200 active:scale-95",
                    isTabActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <TabIcon className="size-[18px]" />
                  <span className="line-clamp-1 max-w-full text-[10px] leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {detailsOrder ? (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Button variant="soft" className="h-11 rounded-xl px-4" onClick={() => setDetailsOrder(null)}>
                <ChevronRight className="size-4" />
                {t("cyclist.back")}
              </Button>
              <p className="text-sm font-semibold text-foreground">{t("cyclist.orderDetails")}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <p className="text-xl font-black text-foreground">#{detailsOrder.id.replace(/-/g, "").slice(-4).toUpperCase()}</p>
                  <p className="text-lg font-bold text-emerald-600">{detailsOrder.totalMad.toFixed(2)} MAD</p>
                </div>

                {detailsOrder.deliveryInstructions?.trim() ? (
                  <div className="mb-4 rounded-xl border border-border bg-background p-4 shadow-sm" dir={isArabic ? "rtl" : "ltr"}>
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-highlight" />
                      <span className="font-bold text-foreground">{t("cyclist.deliveryInstructions")}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{detailsOrder.deliveryInstructions.trim()}</p>
                  </div>
                ) : null}

                <div className="mb-2 flex items-center gap-2" dir={isArabic ? "rtl" : "ltr"}>
                  <PackageSearch className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{t("cyclist.productsList")}</p>
                </div>

                <div className="space-y-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm" dir={isArabic ? "rtl" : "ltr"}>
                  {detailsOrder.items.length > 0 ? (
                    detailsOrder.items.map((item, index) => (
                      <div
                        key={`${detailsOrder.id}-${item.name}-${index}`}
                        className="flex min-w-0 flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="h-12 w-12 object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center text-slate-400">
                                <ShoppingBasket className="size-4" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                          </div>

                          <span className="whitespace-nowrap text-sm font-bold text-slate-900">{item.lineTotalMad.toFixed(2)} MAD</span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2 pr-[3.75rem] text-xs text-slate-600">
                          {item.brandName ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              <Tag className="h-3 w-3" />
                              {item.brandName}
                            </span>
                          ) : null}

                          {item.measurementValue || item.measurementUnit ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-600">
                              <Scale className="h-3 w-3 text-slate-400" />
                              {[item.measurementValue, item.measurementUnit].filter(Boolean).join(" ")}
                            </span>
                          ) : null}

                          <TooltipProvider delayDuration={120}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-help items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                                  <Package className="h-3 w-3" />
                                  <span>{t("cyclist.quantity")} x{item.quantity}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">{t("cyclist.quantityTooltip", { count: item.quantity })}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">{t("cyclist.noOrderItems")}</p>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2" dir={isArabic ? "rtl" : "ltr"}>
                    <ClipboardList className="h-5 w-5 text-slate-600" />
                    <p className="text-sm font-bold text-slate-800">{t("cyclist.orderSummary")}</p>
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t("cyclist.subtotal")}</span>
                    <span>{Math.max(0, detailsOrder.totalMad - detailsOrder.deliveryFeeMad).toFixed(2)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t("cyclist.deliveryFee")}</span>
                    <span>{detailsOrder.deliveryFeeMad.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
                    <span>{t("cyclist.total")}</span>
                    <span>{detailsOrder.totalMad.toFixed(2)} MAD</span>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function OrderCard({
  order,
  isActiveDelivery = false,
  actionLabel,
  actionTone,
  actionIcon: ActionIcon,
  isBusy,
  onOpenDetails,
  onAction,
  onCancel,
}: {
  order: CyclistOrderCard;
  isActiveDelivery?: boolean;
  actionLabel: string;
  actionTone: "primary" | "success";
  actionIcon: typeof Truck;
  isBusy: boolean;
  onOpenDetails?: () => void;
  onAction: () => void;
  onCancel?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language || "en") === "ar";
  const infoAlignClass = isArabic ? "items-start text-right" : "items-end text-left";
  const infoTextAlignClass = isArabic ? "text-right" : "text-left";
  const addressJustifyClass = isArabic ? "justify-start text-right" : "justify-end text-left";
  const actionClass =
    actionTone === "success"
      ? "bg-success text-success-foreground hover:bg-success/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  const shortOrderId = `#${order.id.replace(/-/g, "").slice(-4).toUpperCase()}`;
  const whatsappPhone = order.customerPhone.replace(/\D/g, "");

  if (isActiveDelivery) {
    return (
      <article className="flex flex-col rounded-2xl border border-success/25 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md">
        {order.paymentMethod === "Carnet" ? (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/15 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-destructive">
              <AlertTriangle className="size-4" />
              {t("cyclist.creditWarning")}
            </p>
          </div>
        ) : null}

        <div className="mb-3 flex items-start justify-between border-b border-border pb-3">
          <button type="button" className="font-(family-name:var(--font-headline)) text-2xl font-black text-foreground" onClick={() => onOpenDetails?.()}>
            {shortOrderId}
          </button>
          <p className="text-xl font-bold text-success">{order.totalMad.toFixed(2)} MAD</p>
        </div>

        <div dir={isArabic ? "rtl" : "ltr"} className="mt-4 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-sm">
          <div className="flex w-full flex-row items-start justify-between border-b border-border p-3.5 transition-colors hover:bg-muted/40 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <User className="h-4 w-4 text-muted-foreground" />
              {t("cyclist.fullName")}
            </div>
            <div className={cn("flex w-2/3 flex-col justify-center text-sm font-bold text-foreground", infoAlignClass)}>{order.customerName}</div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-border p-3.5 transition-colors hover:bg-muted/40 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {t("cyclist.phoneNumber")}
            </div>
            <div className={cn("flex w-2/3 flex-col justify-center text-sm font-bold text-foreground", infoAlignClass)}>
              <span dir="ltr" className="font-mono text-sm tracking-wide text-foreground">
                {order.customerPhone}
              </span>
              <div className={cn("mt-1.5 flex flex-row items-center gap-2", isArabic ? "self-start" : "self-end")}>
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
                  aria-label={t("cyclist.callCustomerAria")}
                >
                  <PhoneCall className="size-4" />
                </a>
                <a
                  href={`https://wa.me/${whatsappPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success transition-colors hover:bg-success/20"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t("cyclist.whatsappAria")}
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-border p-3.5 transition-colors hover:bg-muted/40 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <Map className="h-4 w-4 text-muted-foreground" />
              {t("cyclist.area")}
            </div>
            <div className={cn("flex w-2/3 flex-col justify-center text-sm font-bold text-foreground", infoAlignClass)}>{order.deliveryZone}</div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-border p-3.5 transition-colors hover:bg-muted/40 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {t("cyclist.address")}
            </div>
            <div className={cn("flex w-2/3 flex-col justify-center text-sm font-bold text-foreground", infoAlignClass)}>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("inline-flex max-w-full items-center gap-1 whitespace-normal leading-tight text-sm font-bold text-primary hover:opacity-85", addressJustifyClass)}
              >
                <MapPin className="h-4 w-4" />
                {order.deliveryAddress}
              </a>
            </div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-border p-3.5 transition-colors hover:bg-muted/40 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("cyclist.payment")}
            </div>
            <div className={cn("flex w-2/3 flex-col justify-center text-sm font-bold text-foreground", infoAlignClass)}>
              {order.paymentMethod === "COD" ? (
                <span className={cn("rounded-md border border-highlight/40 bg-highlight/10 px-2.5 py-1 text-[12px] font-semibold text-highlight-foreground", infoTextAlignClass)}>
                  {t("cyclist.codBadge")}
                </span>
              ) : (
                <span className={cn("rounded-md border border-success/30 bg-success/10 px-2.5 py-1 text-[12px] font-semibold text-success", infoTextAlignClass)}>
                  {t("cyclist.carnetBadge")}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button className={`mt-3 w-full rounded-xl py-3 text-lg font-semibold active:scale-95 ${actionClass}`} onClick={onAction} disabled={isBusy}>
          <ActionIcon className="size-4" />
          {isBusy ? t("cyclist.refreshing") : actionLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full text-sm font-bold text-destructive"
          onClick={() => onCancel?.()}
          disabled={isBusy}
        >
          {t("cyclist.cancelOrder")}
        </Button>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="space-y-2">
        {order.paymentMethod === "Carnet" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/15 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-destructive">
              <AlertTriangle className="size-4" />
              {t("cyclist.creditWarning")}
            </p>
          </div>
        ) : null}
        <p className="text-sm font-semibold text-foreground">{order.customerName}</p>
        <a
          href={`tel:${order.customerPhone}`}
          className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
        >
          <PhoneCall className="size-4" />
          {order.customerPhone}
        </a>
        <p className="text-sm text-muted-foreground">{t("cyclist.douar")}: {order.douar}</p>
        <p className="text-sm font-medium text-foreground">{t("cyclist.total")}: {order.totalMad.toFixed(2)} MAD</p>
        <p className="text-xs text-muted-foreground">{t("cyclist.deliveryNotes")}: {order.deliveryNotes || t("cyclist.emptyValue")}</p>
        <p className="text-xs text-muted-foreground">{t("cyclist.savedInstructions")}: {order.savedInstructions || t("cyclist.emptyValue")}</p>
      </div>

      <Button className={`mt-3 h-11 w-full rounded-xl text-base font-semibold active:scale-95 ${actionClass}`} onClick={onAction} disabled={isBusy}>
        <ActionIcon className="size-4" />
        {isBusy ? t("cyclist.refreshing") : actionLabel}
      </Button>
    </article>
  );
}

function PlatformPackOrderCard({
  order,
  isActiveDelivery,
  isBusy,
  onAccept,
  onDeliver,
}: {
  order: CyclistOrderCard;
  isActiveDelivery: boolean;
  isBusy: boolean;
  onAccept: () => void;
  onDeliver: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language || "en") === "ar";

  return (
    <article className="rounded-2xl border border-success/25 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-3 rounded-xl border border-success/45 bg-success/12 p-2.5">
        <p className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-wide text-success">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          {t("cyclist.prepaidZeroBadge")}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{order.customerName}</p>
            <p className="text-xs text-muted-foreground">{order.contactPhone || t("cyclist.emptyValue")}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${order.contactPhone}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground"
              aria-label={t("cyclist.callCustomerAria")}
            >
              <Phone className="size-4" />
            </a>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground"
              aria-label={t("cyclist.openMapAria")}
            >
              <MapPin className="size-4" />
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-2.5">
          <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">{t("cyclist.destinationLabel")}</p>
          <p className="text-sm font-medium text-foreground">{order.deliveryAddress}</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">{t("cyclist.packPayloadLabel")}</p>
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
              <PackageCheck className="size-3.5" />
              {t("cyclist.quantity")}: {order.packQuantity}
            </span>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">{t("cyclist.platformWarehouseHint")}</p>
          <div className="space-y-1">
            {order.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("cyclist.noOrderItems")}</p>
            ) : (
              order.items.map((item, index) => (
                <p key={`${order.id}-platform-pack-item-${index}`} className="text-xs text-foreground">
                  • {item.name} {t("cyclist.times", { count: item.quantity })}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <Button
        className="mt-4 h-11 w-full rounded-xl text-base font-semibold active:scale-95"
        onClick={isActiveDelivery ? onDeliver : onAccept}
        disabled={isBusy}
      >
        {isActiveDelivery ? <Camera className="size-4" /> : <Truck className="size-4" />}
        {isBusy ? t("cyclist.refreshing") : isActiveDelivery ? t("cyclist.scanToDeliver") : t("cyclist.acceptPickup")}
      </Button>
    </article>
  );
}

function EmptyState({ label, hints = [] }: { label: string; hints?: string[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <AppEmptyState
        title={label}
        subtitle={t("cyclist.autoAppearSubtitle")}
        icon={PackageOpen}
        className="rounded-2xl border-border/70 bg-card [&_span]:h-14 [&_span]:w-14 [&_span]:bg-muted [&_span]:text-muted-foreground"
      />

      {hints.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
          <p className="text-xs font-semibold text-foreground">{t("cyclist.visibilityHintsTitle")}</p>
          <ul className="mt-1 list-disc space-y-1 ps-4 text-xs text-muted-foreground">
            {hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
