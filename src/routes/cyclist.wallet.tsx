import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Banknote, Clock3, QrCode, ReceiptText, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { executeVendorQrCashHandover } from "@/lib/cyclists.functions";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";

type CyclistSession = {
  cyclistId: string;
  phoneNumber: string;
  fullName: string;
};

type WalletSummary = {
  cyclistId: string;
  cyclistName: string;
  myEarningsMad: number;
  pendingEarningsMad: number;
  cashToRemitMad: number;
  owedByVendorMad: number;
  pendingEarningsCount: number;
  pendingCashCount: number;
  owedByVendorCount: number;
};

export const Route = createFileRoute("/cyclist/wallet")({
  component: CyclistWalletPage,
});

function CyclistWalletPage() {
  const navigate = useNavigate({ from: "/cyclist/wallet" });
  const queryClient = useQueryClient();
  const executeQrCashHandover = useServerFn(executeVendorQrCashHandover);

  const [session] = useState<CyclistSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CYCLIST_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CyclistSession;
      if (!parsed?.cyclistId || !parsed?.fullName || !parsed?.phoneNumber) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  const [isVendorQrScannerOpen, setIsVendorQrScannerOpen] = useState(false);
  const [vendorQrScannerStatus, setVendorQrScannerStatus] = useState("");
  const vendorQrScannerRef = useRef<any>(null);
  const isVerifyingVendorQrRef = useRef(false);

  const walletQuery = useQuery<WalletSummary>({
    queryKey: ["cyclist", "wallet", "rewrite", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: async () => {
      if (!session?.cyclistId) {
        throw new Error("Cyclist session expired.");
      }

      const { data: cyclistRow, error: cyclistError } = await supabase
        .from("cyclists")
        .select("id, full_name")
        .eq("id", session.cyclistId)
        .maybeSingle();

      if (cyclistError) {
        throw new Error(cyclistError.message);
      }

      if (!cyclistRow?.id) {
        throw new Error("Cyclist account is not linked to this user.");
      }

      const cyclistId = String(session.cyclistId);

      const [myEarningsResult, pendingEarningsResult, cashToRemitResult, owedByVendorResult] = await Promise.all([
        supabase
          .from("orders")
          .select("delivery_fee")
          .eq("cyclist_id", cyclistId)
          .in("status", ["delivered", "cash_transferred_to_vendor"]),
        supabase.from("orders").select("delivery_fee").eq("cyclist_id", cyclistId).eq("status", "delivering"),
        supabase
          .from("orders")
          .select("total_price")
          .eq("cyclist_id", cyclistId)
          .eq("status", "delivered_cash_with_cyclist")
          .eq("payment_method", "COD"),
        supabase
          .from("orders")
          .select("delivery_fee")
          .eq("cyclist_id", cyclistId)
          .eq("status", "delivered")
          .eq("payment_method", "Carnet")
          .eq("vendor_settlement_status", "pending"),
      ]);

      if (myEarningsResult.error) throw new Error(myEarningsResult.error.message);
      if (pendingEarningsResult.error) throw new Error(pendingEarningsResult.error.message);
      if (cashToRemitResult.error) throw new Error(cashToRemitResult.error.message);
      if (owedByVendorResult.error) throw new Error(owedByVendorResult.error.message);

      const myEarningsRows = (myEarningsResult.data ?? []) as Array<{ delivery_fee: number | null }>;
      const pendingEarningsRows = (pendingEarningsResult.data ?? []) as Array<{ delivery_fee: number | null }>;
      const cashRows = (cashToRemitResult.data ?? []) as Array<{ total_price: number | null }>;
      const owedRows = (owedByVendorResult.data ?? []) as Array<{ delivery_fee: number | null }>;

      return {
        cyclistId,
        cyclistName: String(cyclistRow.full_name ?? "Cyclist"),
        myEarningsMad: myEarningsRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0),
        pendingEarningsMad: pendingEarningsRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0),
        cashToRemitMad: cashRows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0),
        owedByVendorMad: owedRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0),
        pendingEarningsCount: pendingEarningsRows.length,
        pendingCashCount: cashRows.length,
        owedByVendorCount: owedRows.length,
      };
    },
  });

  const executeVendorQrCashHandoverMutation = useMutation({
    mutationFn: async ({ vendorId, timestamp }: { vendorId: string; timestamp: string }) => {
      if (!walletQuery.data?.cyclistId) {
        throw new Error("Cyclist session is missing.");
      }

      return executeQrCashHandover({
        data: {
          cyclistId: walletQuery.data.cyclistId,
          qr: {
            action: "vendor_cash_receipt",
            vendor_id: vendorId,
            timestamp,
          },
        },
      });
    },
    onSuccess: async () => {
      toast.success("Cash handover confirmed successfully.");
      await walletQuery.refetch();
      setIsVendorQrScannerOpen(false);
      setVendorQrScannerStatus("");
      isVerifyingVendorQrRef.current = false;
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to confirm handover.");
      setVendorQrScannerStatus("فشل التحقق من رمز التاجر");
      isVerifyingVendorQrRef.current = false;
    },
  });

  const handleVendorQrScan = async (decodedText: string) => {
    if (isVerifyingVendorQrRef.current) return;

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

  useEffect(() => {
    const cyclistId = walletQuery.data?.cyclistId;
    if (!cyclistId) return;

    const channel = supabase
      .channel(`cyclist-wallet-rewrite-${cyclistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cyclist_id=eq.${cyclistId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet", "rewrite", authUserId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authUserId, queryClient, walletQuery.data?.cyclistId]);

  useEffect(() => {
    if (!isVendorQrScannerOpen) {
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
  }, [isVendorQrScannerOpen]);

  if (!authReady) {
    return <main className="min-h-screen bg-muted/20" />;
  }

  if (!authUserId) {
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

  return (
    <main className="min-h-screen bg-muted/20 pb-6">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/cyclist/dashboard" })}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-sm font-semibold text-foreground">Cyclist Wallet · محفظة السائق</h1>
        </div>
      </header>

      <section className="mx-auto w-full max-w-xl space-y-4 px-4 pt-4">
        <Card className="bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-emerald-600" />
              My Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{(summary?.myEarningsMad ?? 0).toFixed(2)} MAD</p>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4 text-slate-500" />
              Pending Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-3xl font-bold text-slate-700">{(summary?.pendingEarningsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">{summary?.pendingEarningsCount ?? 0} active delivery orders.</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <Banknote className="size-4" />
              Cash to Remit · الروسيطة للبائع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-extrabold text-red-600">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs font-medium text-red-700">Cash you must hand over to the vendor.</p>
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 font-bold text-white"
              onClick={() => {
                if ((summary?.cashToRemitMad ?? 0) <= 0) {
                  toast.info("No cash liability to hand over right now.");
                  return;
                }
                setVendorQrScannerStatus("جاري تجهيز الكاميرا...");
                setIsVendorQrScannerOpen(true);
              }}
            >
              <QrCode className="size-5" />
              Scan Vendor QR / مسح كود التاجر لتسليم النقد
            </button>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <ReceiptText className="size-4" />
              Owed by Vendor · مستحقاتي على البائع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-3xl font-bold text-amber-700">{(summary?.owedByVendorMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-amber-800">Delivery fees for Carnet orders.</p>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={isVendorQrScannerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsVendorQrScannerOpen(false);
            setVendorQrScannerStatus("");
            isVerifyingVendorQrRef.current = false;
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Scan Vendor QR / مسح كود التاجر</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <div className="overflow-hidden rounded-2xl border border-border bg-black/90 p-2">
              <div id="wallet-vendor-cash-receipt-qr-reader" className="min-h-[320px] w-full" />
            </div>
            <p className="text-xs text-muted-foreground">{vendorQrScannerStatus}</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
