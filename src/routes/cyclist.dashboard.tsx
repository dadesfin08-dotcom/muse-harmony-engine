import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bike, Camera, CheckCircle2, ChevronRight, ClipboardList, CreditCard, Keyboard, Lock, LogOut, Map, MapPin, MessageCircle, MessageSquareText, Package, PackageSearch, Phone, PhoneCall, Scale, ShoppingBasket, Tag, Truck, User, Volume2, VolumeX, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  acceptDeliveryRun,
  confirmCashHandoverToVendor,
  getCyclistDashboardData,
  markDeliveryAsDelivered,
  setCyclistActiveState,
  type CyclistOrderCard,
  verifyDeliveryCodeAndComplete,
} from "@/lib/cyclists.functions";
import { clearRoleSessions } from "@/lib/operational-auth";
import { playActionSound } from "@/lib/sound-alerts";
import { extractDeliveryCode } from "@/lib/extract-delivery-code";
import appI18n from "@/lib/i18n";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";
const CYCLIST_SOUNDS_STORAGE_KEY = "bzaf.cyclistSoundsEnabled";

type CyclistView = "available" | "active";
type CyclistSession = {
  cyclistId: string;
  phoneNumber: string;
  fullName: string;
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

function CyclistDashboardPage() {
  const { t, i18n: runtimeI18n } = useTranslation();
  const isArabic = (runtimeI18n.resolvedLanguage || runtimeI18n.language || "en") === "ar";
  const navigate = useNavigate({ from: "/cyclist/dashboard" });
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<CyclistView>("available");
  const [isUpdatingOrderId, setIsUpdatingOrderId] = useState<string | null>(null);
  const [settlingVendorId, setSettlingVendorId] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [hasAudioPermissionHintShown, setHasAudioPermissionHintShown] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerOrder, setScannerOrder] = useState<CyclistOrderCard | null>(null);
  const [scannerStatus, setScannerStatus] = useState(() => runtimeI18n.t("cyclist.readyToScan"));
  const [manualCode, setManualCode] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isScannerSuccess, setIsScannerSuccess] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState<CyclistOrderCard | null>(null);
  const previousAvailableRunIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRunsRef = useRef(false);
  const qrScannerRef = useRef<any>(null);
  const isVerifyingCodeRef = useRef(false);
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
  const verifyDeliveryCode = useServerFn(verifyDeliveryCodeAndComplete);
  const markDelivered = useServerFn(markDeliveryAsDelivered);
  const confirmCashHandover = useServerFn(confirmCashHandoverToVendor);

  const dashboardQuery = useQuery({
    queryKey: ["cyclist", "dashboard", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: () => fetchDashboardData({ data: { cyclistId: session!.cyclistId } }),
    refetchInterval: session?.cyclistId ? 4_000 : false,
  });

  const cyclist = dashboardQuery.data?.cyclist;
  const availableRuns = dashboardQuery.data?.availableRuns ?? [];
  const activeDeliveries = dashboardQuery.data?.activeDeliveries ?? [];
  const pendingSettlements = dashboardQuery.data?.pendingSettlements ?? [];
  const hasActiveDeliveryLock = activeDeliveries.length > 0;

  const confirmCashHandoverMutation = useMutation({
    mutationFn: async ({ vendorId }: { vendorId: string }) => {
      if (!session?.cyclistId) {
        throw new Error("Session expired.");
      }
      return confirmCashHandover({
        data: {
          cyclistId: session.cyclistId,
          vendorId,
        },
      });
    },
    onMutate: ({ vendorId }) => {
      setSettlingVendorId(vendorId);
    },
    onSuccess: async (result) => {
      if (result.settledOrdersCount <= 0) {
        toast.info("لا توجد طلبات نقدية معلقة لهذا التاجر حالياً. تم تحديث البيانات.");
      } else {
        toast.success(
          `تم تأكيد تحويل النقد: ${result.settledOrdersCount} طلب · أرباح التاجر +${result.vendorEarningsAddedMad.toFixed(2)} MAD · مستحقات التطبيق +${result.platformDuesAddedMad.toFixed(2)} MAD`,
        );
      }
      await dashboardQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor", "wallet"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "فشل تأكيد تحويل النقد.");
    },
    onSettled: () => {
      setSettlingVendorId(null);
    },
  });

  const markDeliveryByQrMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      if (!session?.cyclistId) {
        throw new Error("Session expired.");
      }
      return markDelivered({
        data: {
          cyclistId: session.cyclistId,
          orderId,
        },
      });
    },
    onSuccess: async () => {
      setIsScannerSuccess(true);
      setScannerStatus(t("cyclist.scannerVerified"));
      toast.success(t("cyclist.deliveryCompleted"));
      await dashboardQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor", "wallet"] });
      window.setTimeout(() => closeScanner(), 900);
    },
    onError: async (error) => {
      await dashboardQuery.refetch();
      setScannerStatus(t("cyclist.scannerFailed"));
      toast.error(error instanceof Error ? error.message : t("cyclist.failedVerify"));
    },
  });

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

  const onlineCountLabel = useMemo(() => {
    if (activeView === "available") {
      return t("cyclist.availableRunsCount", { count: availableRuns.length });
    }
    return t("cyclist.activeDeliveriesCount", { count: activeDeliveries.length });
  }, [activeView, availableRuns.length, activeDeliveries.length]);

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
      toast.error(error instanceof Error ? error.message : t("cyclist.failedAccept"));
    } finally {
      setIsUpdatingOrderId(null);
    }
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerOrder(null);
    setManualCode("");
    setShowManualEntry(false);
    setIsScannerSuccess(false);
    setScannerStatus(t("cyclist.readyToScan"));
    isVerifyingCodeRef.current = false;
  };

  const handleVerifyDeliveryCode = async (order: CyclistOrderCard, rawValue: string) => {
    if (!session?.cyclistId || isVerifyingCodeRef.current) {
      return;
    }

    const extractedCode = extractDeliveryCode(rawValue, order.id);
    if (!extractedCode) {
      toast.error(t("cyclist.invalidQr"));
      return;
    }

    isVerifyingCodeRef.current = true;
    setIsUpdatingOrderId(order.id);
    setScannerStatus(t("cyclist.scannerVerifying"));

    try {
      queryClient.setQueryData(["cyclist", "dashboard", session.cyclistId], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          activeDeliveries: (current.activeDeliveries as CyclistOrderCard[]).filter(
            (delivery) => delivery.id !== order.id,
          ),
        };
      });

      await verifyDeliveryCode({
        data: {
          cyclistId: session.cyclistId,
          orderId: order.id,
          deliveryAuthCode: extractedCode,
        },
      });

      setIsScannerSuccess(true);
      setScannerStatus(t("cyclist.scannerVerified"));
      toast.success(t("cyclist.deliveryCompleted"));
      await dashboardQuery.refetch();
      window.setTimeout(() => closeScanner(), 900);
    } catch (error) {
      console.error("Failed to verify delivery:", error);
      await dashboardQuery.refetch();
      setScannerStatus(t("cyclist.scannerFailed"));
      toast.error(error instanceof Error ? error.message : t("cyclist.failedVerify"));
      isVerifyingCodeRef.current = false;
    } finally {
      setIsUpdatingOrderId(null);
    }
  };

  const openScannerForOrder = (order: CyclistOrderCard) => {
    setScannerOrder(order);
    setManualCode("");
    setShowManualEntry(false);
    setIsScannerSuccess(false);
    setScannerStatus(t("cyclist.cameraPreparing"));
    setIsScannerOpen(true);
  };

  useEffect(() => {
    if (!isScannerOpen || !scannerOrder || showManualEntry || isScannerSuccess) {
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
            void handleVerifyDeliveryCode(scannerOrder, decodedText);
          },
          () => undefined,
        );

        if (mounted) {
          setScannerStatus(t("cyclist.cameraPointToQr"));
        }
      } catch (error) {
        console.error("QR camera permission/start failed:", error);
        if (mounted) {
          setShowManualEntry(true);
          setScannerStatus(t("cyclist.cameraUnavailableManual"));
        }
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
  }, [isScannerOpen, scannerOrder, showManualEntry, isScannerSuccess]);

  const handleManualVerify = async () => {
    if (!scannerOrder) {
      return;
    }
    await handleVerifyDeliveryCode(scannerOrder, manualCode);
  };

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

        <div className="mx-auto mt-3 flex w-full max-w-lg items-center justify-between rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <span className="text-sm text-muted-foreground">{cyclist?.isActive ? t("cyclist.online") : t("cyclist.offline")}</span>
          <Switch checked={Boolean(cyclist?.isActive)} onCheckedChange={updateOnlineState} />
        </div>
      </header>

      <section className="mx-auto w-full max-w-lg px-4 pt-4">
        <div className="mb-4 inline-flex w-full items-center rounded-xl border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveView("available")}
            className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
              activeView === "available"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t("cyclist.availableRunsTab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveView("active")}
            className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
              activeView === "active"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t("cyclist.activeDeliveriesTab")}
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{onlineCountLabel}</p>
          {dashboardQuery.isLoading ? <p className="text-xs text-muted-foreground">{t("cyclist.refreshing")}</p> : null}
        </div>

        <section className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Pending Settlements · تصفية الحسابات</p>
          </div>
          {pendingSettlements.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending cash handover settlements. · لا توجد تصفية معلقة حالياً.</p>
          ) : (
            <div className="space-y-2">
              {pendingSettlements.map((settlement) => (
                <div key={settlement.vendorId} className="rounded-xl border border-border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{settlement.vendorName}</p>
                      <p className="text-xs text-muted-foreground">{settlement.ordersCount} orders · {settlement.cashToHandoverMad.toFixed(2)} MAD</p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => confirmCashHandoverMutation.mutate({ vendorId: settlement.vendorId })}
                    disabled={confirmCashHandoverMutation.isPending}
                  >
                    {confirmCashHandoverMutation.isPending && settlingVendorId === settlement.vendorId
                      ? "Processing..."
                      : "Confirm Cash Handover to Vendor · تأكيد تسليم المبلغ للتاجر"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {activeView === "available" ? (
          <div className="space-y-3">
            {hasActiveDeliveryLock ? (
              <AppEmptyState
                title={t("cyclist.lockTitle")}
                subtitle={t("cyclist.lockSubtitle")}
                icon={Lock}
                className="bg-card"
              />
            ) : availableRuns.length === 0 ? (
              <EmptyState label={t("cyclist.noReadyDeliveries")} />
            ) : (
              availableRuns.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isActiveDelivery={false}
                  actionLabel={t("cyclist.acceptPickup")}
                  actionTone="primary"
                  actionIcon={Truck}
                  isBusy={isUpdatingOrderId === order.id}
                  onAction={() => handleAcceptDelivery(order)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {activeDeliveries.length === 0 ? (
              <EmptyState label={t("cyclist.noActiveDeliveries")} />
            ) : (
              activeDeliveries.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isActiveDelivery
                  actionLabel={t("cyclist.scanToDeliver")}
                  actionTone="success"
                  actionIcon={Camera}
                  isBusy={isUpdatingOrderId === order.id}
                  onOpenDetails={() => setDetailsOrder(order)}
                  onAction={() => openScannerForOrder(order)}
                />
              ))
            )}
          </div>
        )}
      </section>

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
            ) : showManualEntry ? (
              <div className="flex flex-1 flex-col justify-center gap-4">
                <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">{t("cyclist.enterCustomerPin")}</p>
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("cyclist.pinPlaceholder")}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-center text-base tracking-wide outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  />
                  <Button
                    className="h-11 w-full rounded-xl"
                    onClick={handleManualVerify}
                    disabled={!scannerOrder || manualCode.length < 4 || isUpdatingOrderId === scannerOrder.id}
                  >
                    {isUpdatingOrderId === scannerOrder?.id ? t("cyclist.verifying") : t("cyclist.verifyAndDeliver")}
                  </Button>
                </div>
                <Button variant="soft" className="h-10 rounded-xl" onClick={() => setShowManualEntry(false)}>
                  <Camera className="size-4" />
                  {t("cyclist.backToCamera")}
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-border bg-black/90 p-2">
                  <div id="delivery-qr-reader" className="min-h-[340px] w-full" />
                </div>
                <Button variant="soft" className="h-10 rounded-xl" onClick={() => setShowManualEntry(true)}>
                  <Keyboard className="size-4" />
                  {t("cyclist.enterCodeManually")}
                </Button>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">{scannerStatus}</p>
          </div>
        </DialogContent>
      </Dialog>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white px-3 py-2 pb-safe">
        <div className="mx-auto flex w-full max-w-lg flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActiveView("available")}
            className={`h-12 min-w-0 flex-1 rounded-xl px-2 text-center text-[13px] font-semibold whitespace-nowrap transition-all duration-200 ${
              activeView === "available"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t("cyclist.availableRunsTab")}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/cyclist/wallet" })}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-100"
            aria-label={t("cyclist.walletAria")}
          >
            <Wallet className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveView("active")}
            className={`h-12 min-w-0 flex-1 rounded-xl px-2 text-center text-[13px] font-semibold whitespace-nowrap transition-all duration-200 ${
              activeView === "active"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t("cyclist.activeDeliveriesTab")}
          </button>
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
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" dir={isArabic ? "rtl" : "ltr"}>
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-5 w-5 text-amber-500" />
                      <span className="font-bold text-slate-800">{t("cyclist.deliveryInstructions")}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{detailsOrder.deliveryInstructions.trim()}</p>
                  </div>
                ) : null}

                <div className="mb-2 flex items-center gap-2" dir={isArabic ? "rtl" : "ltr"}>
                  <PackageSearch className="h-5 w-5 text-slate-600" />
                  <p className="text-sm font-bold text-slate-800">{t("cyclist.productsList")}</p>
                </div>

                <div className="space-y-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" dir="rtl">
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
}: {
  order: CyclistOrderCard;
  isActiveDelivery?: boolean;
  actionLabel: string;
  actionTone: "primary" | "success";
  actionIcon: typeof Truck;
  isBusy: boolean;
  onOpenDetails?: () => void;
  onAction: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language || "en") === "ar";
  const actionClass =
    actionTone === "success"
      ? "bg-success text-success-foreground hover:bg-success/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  const shortOrderId = `#${order.id.replace(/-/g, "").slice(-4).toUpperCase()}`;
  const whatsappPhone = order.customerPhone.replace(/\D/g, "");

  if (isActiveDelivery) {
    return (
      <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
        {order.paymentMethod === "Carnet" ? (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/15 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-destructive">
              <AlertTriangle className="size-4" />
              {t("cyclist.creditWarning")}
            </p>
          </div>
        ) : null}

        <div className="mb-4 flex items-start justify-between border-b border-border pb-3">
          <button type="button" className="font-(family-name:var(--font-headline)) text-2xl font-black text-gray-900" onClick={() => onOpenDetails?.()}>
            {shortOrderId}
          </button>
          <p className="text-xl font-bold text-emerald-600">{order.totalMad.toFixed(2)} MAD</p>
        </div>

        <div dir={isArabic ? "rtl" : "ltr"} className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-sm">
          <div className="flex w-full flex-row items-start justify-between border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-50 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-slate-400">
              <User className="h-4 w-4 text-slate-400" />
              {t("cyclist.fullName")}
            </div>
            <div className="flex w-2/3 flex-col items-end justify-center text-left text-sm font-bold text-slate-800">{order.customerName}</div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-50 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-slate-400">
              <Phone className="h-4 w-4 text-slate-400" />
              {t("cyclist.phoneNumber")}
            </div>
            <div className="flex w-2/3 flex-col items-end justify-center text-left text-sm font-bold text-slate-800">
              <span dir="ltr" className="font-mono text-sm tracking-wide text-slate-700">
                {order.customerPhone}
              </span>
              <div className="mt-1.5 flex flex-row items-center gap-2">
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                  aria-label={t("cyclist.callCustomerAria")}
                >
                  <PhoneCall className="size-4" />
                </a>
                <a
                  href={`https://wa.me/${whatsappPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-colors hover:bg-emerald-200"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t("cyclist.whatsappAria")}
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-50 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-slate-400">
              <Map className="h-4 w-4 text-slate-400" />
              {t("cyclist.area")}
            </div>
            <div className="flex w-2/3 flex-col items-end justify-center text-left text-sm font-bold text-slate-800">{order.deliveryZone}</div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-50 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-slate-400">
              <MapPin className="h-4 w-4 text-slate-400" />
              {t("cyclist.address")}
            </div>
            <div className="flex w-2/3 flex-col items-end justify-center text-left text-sm font-bold text-slate-800">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center justify-end gap-1 whitespace-normal text-right leading-tight text-sm font-bold text-emerald-700 hover:text-emerald-800"
              >
                <MapPin className="h-4 w-4" />
                {order.deliveryAddress}
              </a>
            </div>
          </div>

          <div className="flex w-full flex-row items-start justify-between border-b border-slate-100 p-3.5 transition-colors hover:bg-slate-50 last:border-0">
            <div className="flex w-1/3 shrink-0 items-center gap-2 text-[13px] font-medium text-slate-400">
              <CreditCard className="h-4 w-4 text-slate-400" />
              {t("cyclist.payment")}
            </div>
            <div className="flex w-2/3 flex-col items-end justify-center text-left text-sm font-bold text-slate-800">
              {order.paymentMethod === "COD" ? (
                <span className="rounded-md border border-orange-200/50 bg-orange-50 px-2.5 py-1 text-[12px] font-semibold text-orange-700">
                  {t("cyclist.codBadge")}
                </span>
              ) : (
                <span className="rounded-md border border-emerald-200/50 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                  {t("cyclist.carnetBadge")}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button className={`mt-4 w-full rounded-xl py-3 text-lg font-semibold ${actionClass}`} onClick={onAction} disabled={isBusy}>
          <ActionIcon className="size-4" />
          {isBusy ? t("cyclist.refreshing") : actionLabel}
        </Button>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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
        <p className="text-xs text-muted-foreground">{t("cyclist.deliveryNotes")}: {order.deliveryNotes || "—"}</p>
        <p className="text-xs text-muted-foreground">{t("cyclist.savedInstructions")}: {order.savedInstructions || "—"}</p>
      </div>

      <Button className={`mt-4 h-11 w-full rounded-xl text-base font-semibold ${actionClass}`} onClick={onAction} disabled={isBusy}>
        <ActionIcon className="size-4" />
        {isBusy ? t("cyclist.refreshing") : actionLabel}
      </Button>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  const { t } = useTranslation();

  return (
    <AppEmptyState
      title={label}
      subtitle={t("cyclist.autoAppearSubtitle")}
      icon={PackageSearch}
      className="bg-card"
    />
  );
}
