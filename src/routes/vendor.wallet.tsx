import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, QrCode, Trophy, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getVendorDashboardData,
  getVendorSettlementSummary,
} from "@/lib/orders.functions";

export const Route = createFileRoute("/vendor/wallet")({
  component: VendorWalletPage,
});

function VendorWalletPage() {
  const navigate = useNavigate({ from: "/vendor/wallet" });
  const queryClient = useQueryClient();
  const [isVendorHandoverQrOpen, setIsVendorHandoverQrOpen] = useState(false);
  const [isPlatformDuesQrOpen, setIsPlatformDuesQrOpen] = useState(false);
  const vendorPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.vendorSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);

  const fetchDashboard = useServerFn(getVendorDashboardData);
  const fetchSettlementSummary = useServerFn(getVendorSettlementSummary);

  const dashboardQuery = useQuery({
    queryKey: ["vendor", "dashboard"],
    queryFn: () => fetchDashboard({ data: { phoneNumber: vendorPhoneNumber } }),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
  });

  const vendorId = dashboardQuery.data?.vendor?.id ?? null;

  const settlementQuery = useQuery({
    queryKey: ["vendor", "wallet", vendorId, vendorPhoneNumber],
    enabled: Boolean(vendorId && vendorPhoneNumber),
    queryFn: () => fetchSettlementSummary({ data: { phoneNumber: vendorPhoneNumber } }),
    refetchInterval: 4_000,
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
          void queryClient.invalidateQueries({ queryKey: ["vendor", "wallet", vendorId] });
          void queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, vendorId]);


  const summary = settlementQuery.data;
  const hasSummary = Boolean(summary);
  const formatMad = (value: number | undefined) => (hasSummary ? `${(value ?? 0).toFixed(2)} MAD` : "--");
  const deliveredOrders = (dashboardQuery.data?.orders ?? [])
    .filter((order) => ["delivered", "delivered_cash_with_cyclist", "cash_transferred_to_vendor"].includes(order.status))
    .slice(0, 8);
  const platformCollectionQrPayload = useMemo(() => {
    if (!vendorId) return null;
    const amountMad = Number(summary?.platformDuesMad ?? 0);
    if (!Number.isFinite(amountMad) || amountMad <= 0) return null;

    return JSON.stringify({
      vendor_id: vendorId,
      amount_owed: amountMad.toFixed(2),
    });
  }, [summary?.platformDuesMad, vendorId]);

  const vendorHandoverQrPayload = useMemo(() => {
    if (!vendorId) return null;
    return JSON.stringify({ action: "vendor_handover", vendor_id: vendorId });
  }, [vendorId]);

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
              <p className="text-2xl font-semibold text-foreground">{formatMad(summary?.totalCashInHandMad)}</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">صافي أرباحي · My Net Profit</p>
              <p className="text-xl font-semibold text-success">{formatMad(summary?.myNetProfitMad)}</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-muted-foreground">مستحقات المنصة · Platform Dues</p>
              <p className="text-xl font-semibold text-destructive">{formatMad(summary?.platformDuesMad)}</p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                if (!platformCollectionQrPayload) {
                  toast.info("No platform dues pending right now.");
                  return;
                }
                setIsPlatformDuesQrOpen(true);
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

      <Dialog open={isPlatformDuesQrOpen} onOpenChange={setIsPlatformDuesQrOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Platform Dues QR · رمز أداء المستحقات</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Show this QR to Super-Admin to confirm your dues collection.</p>
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              {platformCollectionQrPayload ? <QRCodeSVG value={platformCollectionQrPayload} size={220} includeMargin /> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </main>
  );
}