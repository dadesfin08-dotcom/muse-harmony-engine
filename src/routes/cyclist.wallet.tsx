import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, HandCoins, History, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import {
  executeVendorQrCashHandover,
  getCyclistEarningsHistory,
  getCyclistWalletSummary,
} from "@/lib/cyclists.functions";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";

type CyclistSession = {
  cyclistId: string;
  fullName: string;
  phoneNumber: string;
};

type EarningsPeriod = "today" | "week" | "month";

export const Route = createFileRoute("/cyclist/wallet")({
  component: CyclistWalletPage,
});

function CyclistWalletPage() {
  const navigate = useNavigate({ from: "/cyclist/wallet" });
  const queryClient = useQueryClient();
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isVendorQrScannerOpen, setIsVendorQrScannerOpen] = useState(false);
  const [vendorQrScannerStatus, setVendorQrScannerStatus] = useState("");
  const [isVendorQrScannerSuccess, setIsVendorQrScannerSuccess] = useState(false);
  const vendorQrScannerRef = useRef<any>(null);
  const isVerifyingVendorQrRef = useRef(false);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>("today");
  const [session] = useState<CyclistSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CYCLIST_SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CyclistSession;
    } catch {
      return null;
    }
  });

  const fetchWalletSummary = useServerFn(getCyclistWalletSummary);
  const fetchEarningsHistory = useServerFn(getCyclistEarningsHistory);
  const executeQrCashHandover = useServerFn(executeVendorQrCashHandover);

  const executeVendorQrCashHandoverMutation = useMutation({
    mutationFn: async ({ vendorId, timestamp }: { vendorId: string; timestamp: string }) => {
      if (!session?.cyclistId) {
        throw new Error("Session expired.");
      }
      return executeQrCashHandover({
        data: {
          cyclistId: session.cyclistId,
          qr: {
            action: "vendor_cash_receipt",
            vendor_id: vendorId,
            timestamp,
          },
        },
      });
    },
    onSuccess: async () => {
      setIsVendorQrScannerSuccess(true);
      setVendorQrScannerStatus("تم تسليم العهدة بنجاح");
      toast.success("تم تسليم العهدة بنجاح");
      await walletQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["cyclist", "dashboard", session?.cyclistId ?? null] });
      window.setTimeout(() => {
        setIsVendorQrScannerOpen(false);
        setIsVendorQrScannerSuccess(false);
        setVendorQrScannerStatus("");
        isVerifyingVendorQrRef.current = false;
      }, 900);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "فشل تأكيد تحويل النقد.");
      setVendorQrScannerStatus("فشل التحقق من رمز التاجر");
      isVerifyingVendorQrRef.current = false;
    },
  });

  const handleVendorQrScan = async (decodedText: string) => {
    if (!session?.cyclistId || isVerifyingVendorQrRef.current) return;

    try {
      const parsed = JSON.parse(decodedText) as {
        action?: string;
        vendor_id?: string;
        timestamp?: string;
      };

      if (
        parsed?.action !== "vendor_cash_receipt" ||
        typeof parsed.vendor_id !== "string" ||
        typeof parsed.timestamp !== "string"
      ) {
        throw new Error("Invalid vendor QR payload");
      }

      isVerifyingVendorQrRef.current = true;
      setVendorQrScannerStatus("جاري التحقق من الرمز...");
      await executeVendorQrCashHandoverMutation.mutateAsync({
        vendorId: parsed.vendor_id,
        timestamp: parsed.timestamp,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "QR غير صالح");
      setVendorQrScannerStatus("رمز غير صالح، حاول مرة أخرى.");
      isVerifyingVendorQrRef.current = false;
    }
  };

  const walletQuery = useQuery({
    queryKey: ["cyclist", "wallet", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: () => fetchWalletSummary({ data: { cyclistId: session!.cyclistId } }),
    refetchInterval: 4_000,
  });

  const earningsHistoryQuery = useQuery({
    queryKey: ["cyclist", "wallet", "earnings-history", session?.cyclistId ?? null, earningsPeriod],
    enabled: Boolean(session?.cyclistId),
    queryFn: () =>
      fetchEarningsHistory({
        data: {
          cyclistId: session!.cyclistId,
          period: earningsPeriod,
        },
      }),
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (!session?.cyclistId) return;

    const channel = supabase
      .channel(`cyclist-wallet-${session.cyclistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cyclist_id=eq.${session.cyclistId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet", session.cyclistId] });
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "dashboard", session.cyclistId] });
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet", "earnings-history", session.cyclistId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, session?.cyclistId]);

  useEffect(() => {
    if (!isVendorQrScannerOpen || isVendorQrScannerSuccess) {
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const scanner = new Html5Qrcode("wallet-vendor-cash-receipt-qr-reader");
        vendorQrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            void handleVendorQrScan(decodedText);
          },
          () => undefined,
        );

        if (mounted) {
          setVendorQrScannerStatus("وجّه الكاميرا إلى رمز التاجر");
        }
      } catch {
        if (mounted) {
          setVendorQrScannerStatus("تعذر فتح الكاميرا لمسح كود التاجر.");
          toast.error("تعذر فتح الكاميرا لمسح كود التاجر.");
        }
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      const scanner = vendorQrScannerRef.current;
      vendorQrScannerRef.current = null;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            void scanner.clear().catch(() => undefined);
          });
      }
    };
  }, [isVendorQrScannerOpen, isVendorQrScannerSuccess]);

  if (!session?.cyclistId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm text-muted-foreground">Session expired, please login again.</p>
            <Button className="w-full" onClick={() => navigate({ to: "/cyclist/login" })}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const summary = walletQuery.data;
  const earningsHistory = earningsHistoryQuery.data;

  const periodLabels: Array<{ value: EarningsPeriod; label: string }> = [
    { value: "today", label: "Today · اليوم" },
    { value: "week", label: "This Week · هذا الأسبوع" },
    { value: "month", label: "This Month · هذا الشهر" },
  ];

  const formatOrderDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("fr-MA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/cyclist/dashboard" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-bold tracking-tight text-foreground">Cyclist Wallet</h1>
            <p className="text-xs text-muted-foreground">محفظة السائق</p>
          </div>
          <span className="w-9" />
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              My Earnings · أرباح التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.myEarningsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">All-time delivered earnings · أرباح التوصيل منذ البداية</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              Pending Earnings · أرباح قيد التسوية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.pendingEarningsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              Delivered orders pending settlement: {summary?.pendingSettlementOrdersCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              Owed by Vendor · مستحقاتي على البائع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.owedByVendorMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              Pending carnet delivery fees: {summary?.pendingCarnetSettlementOrdersCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              Cash to Remit · الروسيطة للبائع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              Pending cash orders: {summary?.pendingCashSettlementOrdersCount ?? 0}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                if ((summary?.pendingSettlementOrdersCount ?? 0) <= 0) {
                  toast.info("No pending settlement. · ما كاين حتى تسوية معلقة دابا");
                  return;
                }
                setVendorQrScannerStatus("جاري تجهيز الكاميرا...");
                setIsVendorQrScannerSuccess(false);
                setIsVendorQrScannerOpen(true);
              }}
            >
              Handover Cash · تسليم النقود
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" />
              Earnings History · سجل الأرباح
            </CardTitle>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {periodLabels.map((period) => (
                <Button
                  key={period.value}
                  type="button"
                  size="sm"
                  variant={earningsPeriod === period.value ? "default" : "outline"}
                  onClick={() => setEarningsPeriod(period.value)}
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Delivery Fees · مجموع رسوم التوصيل</p>
              <p className="text-2xl font-semibold">{(earningsHistory?.totalEarningsMad ?? 0).toFixed(2)} MAD</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-2">
              <p className="text-xs text-muted-foreground">Completed Deliveries · الطلبات المكتملة</p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(earningsHistory?.deliveries?.length ?? 0) === 0 ? (
                  <AppEmptyState
                    title="No deliveries for this period. · لا توجد عمليات توصيل في هذه الفترة."
                    subtitle="Completed delivery records will appear here automatically."
                    className="py-5"
                  />
                ) : (
                  earningsHistory!.deliveries.map((delivery) => (
                    <div key={delivery.orderId} className="rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">Order #{delivery.orderId.slice(0, 8)}</p>
                          <p className="text-[11px] text-muted-foreground">{formatOrderDateTime(delivery.deliveredAt)}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-primary">+ {delivery.deliveryFeeMad.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isVendorQrScannerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsVendorQrScannerOpen(false);
            setIsVendorQrScannerSuccess(false);
            setVendorQrScannerStatus("");
            isVerifyingVendorQrRef.current = false;
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>مسح كود التاجر لتسليم النقد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            {isVendorQrScannerSuccess ? (
              <div className="flex flex-col items-center justify-center py-6">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-10" />
                </span>
                <p className="mt-3 text-lg font-semibold text-success">تم تسليم العهدة بنجاح</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-black/90 p-2">
                <div id="wallet-vendor-cash-receipt-qr-reader" className="min-h-[320px] w-full" />
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Full Cash to Handover · المبلغ الكامل للتسليم</p>
              <p className="text-xl font-semibold">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            </div>
            <p className="text-xs text-muted-foreground">{vendorQrScannerStatus}</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}