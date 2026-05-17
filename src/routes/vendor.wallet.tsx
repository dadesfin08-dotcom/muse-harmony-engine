import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, QrCode, Trophy, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAppLanguage } from "@/hooks/use-localization";
import { withLocale } from "@/lib/localization";
import { formatMoroccoPhoneForPayload, normalizeMoroccoPhoneInput } from "@/lib/morocco-phone";
import { getVendorCarnetData } from "@/lib/carnet.functions";
import {
  getVendorDashboardData,
  getVendorSettlementSummary,
} from "@/lib/orders.functions";
import { recordVendorQrPayment } from "@/lib/vendors.functions";

export const Route = createFileRoute("/vendor/wallet")({
  component: VendorWalletPage,
});

function VendorWalletPage() {
  const { t } = useTranslation();
  const { language: activeLanguage } = useAppLanguage();
  const navigate = useNavigate({ from: "/vendor/wallet" });
  const queryClient = useQueryClient();
  const [isVendorHandoverQrOpen, setIsVendorHandoverQrOpen] = useState(false);
  const [isPlatformScannerOpen, setIsPlatformScannerOpen] = useState(false);
  const [isSubmittingPlatformPayment, setIsSubmittingPlatformPayment] = useState(false);
  const [pendingScannedPayment, setPendingScannedPayment] = useState<{
    amount: number;
    timestamp: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const vendorPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.vendorSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);
  const normalizedVendorPhoneNumber = useMemo(() => {
    const normalizedLocal = normalizeMoroccoPhoneInput(vendorPhoneNumber);
    return normalizedLocal.length === 9 ? formatMoroccoPhoneForPayload(normalizedLocal) : "";
  }, [vendorPhoneNumber]);

  const fetchDashboard = useServerFn(getVendorDashboardData);
  const fetchCarnet = useServerFn(getVendorCarnetData);
  const fetchSettlementSummary = useServerFn(getVendorSettlementSummary);
  const submitVendorQrPayment = useServerFn(recordVendorQrPayment);

  const dashboardQuery = useQuery({
    queryKey: ["vendor", "dashboard"],
    enabled: Boolean(normalizedVendorPhoneNumber),
    queryFn: () =>
      fetchDashboard({
        data: withLocale(activeLanguage, { phoneNumber: normalizedVendorPhoneNumber }),
      }),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
  });

  const carnetQuery = useQuery({
    queryKey: ["vendor", "carnet", normalizedVendorPhoneNumber],
    enabled: Boolean(normalizedVendorPhoneNumber),
    queryFn: () => fetchCarnet({ data: { phoneNumber: normalizedVendorPhoneNumber } }),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
  });

  const vendorId = dashboardQuery.data?.vendor?.id ?? null;

  const settlementQuery = useQuery({
    queryKey: ["vendor", "wallet", vendorId, normalizedVendorPhoneNumber],
    enabled: Boolean(vendorId && normalizedVendorPhoneNumber),
    queryFn: () => fetchSettlementSummary({ data: { phoneNumber: normalizedVendorPhoneNumber } }),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-wallet-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["vendor", "wallet", vendorId, normalizedVendorPhoneNumber] });
          void queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, vendorId, normalizedVendorPhoneNumber]);

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-ledger-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_commission_ledger",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["vendor", "wallet", vendorId, normalizedVendorPhoneNumber] });
          void queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, vendorId, normalizedVendorPhoneNumber]);

  const summary = settlementQuery.data;
  const cashBreakdown = useMemo(() => {
    const dashboardOrders = dashboardQuery.data?.orders ?? [];
    const transferredCashOrders = dashboardOrders.filter((order) => {
      const isTransferred = order.status === "cash_transferred_to_vendor";
      const paymentMethod = String(order.payment_method ?? "").trim().toLowerCase();
      const isCash = paymentMethod === "cod" || paymentMethod === "cash";
      return isTransferred && isCash;
    });

    const totalCashInHandMad = transferredCashOrders.reduce((sum, order) => sum + Number(order.total_price ?? 0), 0);
    const myNetProfitMad = transferredCashOrders.reduce(
      (sum, order) => sum + Math.max(Number(order.total_price ?? 0) - Number(order.delivery_fee ?? 0), 0),
      0,
    );
    const platformDuesMad = Number(dashboardQuery.data?.vendor?.platformDuesMad ?? 0);

    return {
      totalCashInHandMad: Math.round(totalCashInHandMad * 100) / 100,
      myNetProfitMad: Math.round(myNetProfitMad * 100) / 100,
      platformDuesMad: Math.round(platformDuesMad * 100) / 100,
    };
  }, [dashboardQuery.data?.orders, dashboardQuery.data?.vendor?.platformDuesMad]);
  const hasSummary = Boolean(summary);
  const hasCashBreakdown = Boolean(dashboardQuery.data);
  const formatMad = (value: number | undefined) => (hasSummary ? `${(value ?? 0).toFixed(2)} MAD` : "--");
  const formatCashBreakdownMad = (value: number | undefined) =>
    hasCashBreakdown ? `${(value ?? 0).toFixed(2)} MAD` : "--";
  const deliveredOrders = (dashboardQuery.data?.orders ?? [])
    .filter((order) => ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"].includes(order.status))
    .slice(0, 8);
  const vendorHandoverQrPayload = useMemo(() => {
    if (!vendorId) return null;
    return JSON.stringify({ action: "vendor_handover", vendor_id: vendorId });
  }, [vendorId]);

  useEffect(() => {
    if (!isPlatformScannerOpen || !vendorId) return;

    let mounted = true;
    let scanner: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        scanner = new Html5Qrcode("vendor-platform-payment-qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            try {
              const raw = JSON.parse(decodedText) as {
                action?: string;
                vendor_id?: string;
                amount?: number;
                timestamp?: string;
              };

              if (raw.action !== "platform_commission_payment") {
                toast.error("Invalid QR action.");
                return;
              }

              if (raw.vendor_id !== vendorId) {
                toast.error("This QR is not assigned to your vendor account.");
                return;
              }

              const amount = Number(raw.amount ?? 0);
              if (!Number.isFinite(amount) || amount <= 0) {
                toast.error("Invalid payment amount in QR payload.");
                return;
              }

              setPendingScannedPayment({
                amount,
                timestamp: String(raw.timestamp ?? new Date().toISOString()),
                payload: raw as Record<string, unknown>,
              });
              setIsPlatformScannerOpen(false);
            } catch {
              toast.error("Invalid payment QR payload.");
            }
          },
          () => undefined,
        );
      } catch (error) {
        console.error("Vendor platform scanner failed:", error);
        toast.error("Unable to open QR scanner.");
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            void scanner.clear().catch(() => undefined);
          });
      }
    };
  }, [isPlatformScannerOpen, vendorId]);

  const handleConfirmPlatformPayment = async () => {
    if (!pendingScannedPayment || isSubmittingPlatformPayment) return;

    setIsSubmittingPlatformPayment(true);
    try {
      if (!vendorId || !normalizedVendorPhoneNumber) {
        toast.error("Vendor session missing. Please log in again.");
        return;
      }

      const normalizedAmount = Number.parseFloat(String(pendingScannedPayment.amount ?? 0));
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error("Invalid payment amount.");
      }

      await submitVendorQrPayment({
        data: {
          vendorId,
          phoneNumber: normalizedVendorPhoneNumber,
          amount: Number(normalizedAmount.toFixed(2)),
          timestamp: pendingScannedPayment.timestamp,
          qrPayload: pendingScannedPayment.payload,
        },
      });

      setPendingScannedPayment(null);
      await queryClient.invalidateQueries({ queryKey: ["vendor", "wallet", vendorId, normalizedVendorPhoneNumber] });
      await queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
      toast.success("Payment confirmed successfully!");
    } catch (error) {
      console.error("Ledger Insert Failed:", error);
      toast.error("Failed to process payment. Check your connection.");
    } finally {
      setIsSubmittingPlatformPayment(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/vendor/dashboard" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-bold tracking-tight text-foreground">Cash Reconciliation</h1>
            <p className="text-xs text-muted-foreground">تسوية واستلام النقود</p>
          </div>
          <span className="w-9" />
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Unsettled Cash with Cyclists · نقود غير مسواة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMad(summary?.unsettledCashWithCyclistsMad)}</p>
            <p className="text-xs text-muted-foreground">
              Cyclists with pending remittance: {hasSummary ? summary?.pendingCyclistCount ?? 0 : "--"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Cash Breakdown · تفصيل النقد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">إجمالي النقد المستلم · Total Cash in Hand</p>
              <p className="text-2xl font-semibold text-foreground">{formatCashBreakdownMad(cashBreakdown.totalCashInHandMad)}</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">صافي أرباحي · My Net Profit</p>
              <p className="text-xl font-semibold text-success">{formatCashBreakdownMad(cashBreakdown.myNetProfitMad)}</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">مستحقات المنصة · Platform Dues</p>
              <p className="text-xl font-semibold text-destructive">{formatCashBreakdownMad(cashBreakdown.platformDuesMad)}</p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                const platformDuesMad = Number(cashBreakdown.platformDuesMad ?? 0);
                if (!Number.isFinite(platformDuesMad) || platformDuesMad <= 0) {
                  toast.info("No platform dues pending right now.");
                  return;
                }
                setIsPlatformScannerOpen(true);
              }}
            >
              <QrCode className="size-4" />
              Pay Admin via QR · أداء مستحقات المنصة
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Owed to Cyclist · مستحقات التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMad(summary?.owedToCyclistMad)}</p>
            <p className="text-xs text-muted-foreground">Pending credit/carnet delivery fees.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Received Today · مجموع المستلم اليوم</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{formatMad(summary?.totalReceivedTodayMad)}</p>
            <Button className="w-full" onClick={() => setIsVendorHandoverQrOpen(true)}>
              <QrCode className="size-4" />
              Show Vendor Handover QR · عرض رمز تسليم النقد
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" />
              Lifetime Earnings · إجمالي الأرباح منذ البداية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMad(summary?.lifetimeEarningsMad)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Delivered Orders · الطلبات المسلمة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deliveredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivered orders yet.</p>
            ) : (
              deliveredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate({ to: "/vendor/order/$orderId", params: { orderId: order.id } })}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="text-sm text-foreground">Order #{order.id.slice(0, 8)}</span>
                  <span className="text-sm font-semibold text-foreground">{Number(order.total_price ?? 0).toFixed(2)} MAD</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isVendorHandoverQrOpen} onOpenChange={setIsVendorHandoverQrOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Vendor Handover QR · رمز تسليم للتاجر</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Cyclist scans this for settlement transition.</p>
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              {vendorHandoverQrPayload ? <QRCodeSVG value={vendorHandoverQrPayload} size={220} includeMargin /> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlatformScannerOpen} onOpenChange={setIsPlatformScannerOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Scan Admin QR · مسح رمز مسؤول المنصة</DialogTitle>
          </DialogHeader>
          <div id="vendor-platform-payment-qr-reader" className="min-h-[320px] overflow-hidden rounded-xl border border-border" />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingScannedPayment)} onOpenChange={(open) => (!open ? setPendingScannedPayment(null) : undefined)}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Payment · تأكيد الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Pay <span className="font-semibold">{Number(pendingScannedPayment?.amount ?? 0).toFixed(2)} MAD</span> to Platform Admin?
            </p>
            <p className="text-muted-foreground">Timestamp: {pendingScannedPayment?.timestamp ?? "--"}</p>
            <Button className="w-full" onClick={() => void handleConfirmPlatformPayment()} disabled={isSubmittingPlatformPayment}>
              {isSubmittingPlatformPayment ? "Processing..." : "Confirm Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </main>
  );
}