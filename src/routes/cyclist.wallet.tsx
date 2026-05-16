import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowLeft, HandCoins, History, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { getCyclistEarningsHistory, getCyclistWalletSummary } from "@/lib/cyclists.functions";

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
  const { t } = useTranslation();
  const navigate = useNavigate({ from: "/cyclist/wallet" });
  const queryClient = useQueryClient();
  const [isQrOpen, setIsQrOpen] = useState(false);
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

  if (!session?.cyclistId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm text-muted-foreground">{t("cyclistWallet.sessionExpired")}</p>
            <Button className="w-full" onClick={() => navigate({ to: "/cyclist/login" })}>
              {t("cyclistWallet.goToLogin")}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const summary = walletQuery.data;
  const earningsHistory = earningsHistoryQuery.data;

  const periodLabels: Array<{ value: EarningsPeriod; label: string }> = [
    { value: "today", label: t("cyclistWallet.periodToday") },
    { value: "week", label: t("cyclistWallet.periodWeek") },
    { value: "month", label: t("cyclistWallet.periodMonth") },
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
    <main className="min-h-screen bg-muted/20 px-4 py-4 pb-24">
      <motion.div
        className="mx-auto w-full max-w-xl space-y-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <header className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm backdrop-blur">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/cyclist/dashboard" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-bold tracking-tight text-foreground">{t("cyclistWallet.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("cyclistWallet.subtitle")}</p>
          </div>
          <span className="w-9" />
        </header>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <Card className="border-success/25">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              {t("cyclistWallet.myEarnings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.myEarningsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">{t("cyclistWallet.myEarningsHint")}</p>
          </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
          <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              {t("cyclistWallet.pendingEarnings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.pendingEarningsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              {t("cyclistWallet.pendingSettlementOrders", { count: summary?.pendingSettlementOrdersCount ?? 0 })}
            </p>
          </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              {t("cyclistWallet.owedByVendor")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.owedByVendorMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              {t("cyclistWallet.pendingCarnetOrders", { count: summary?.pendingCarnetSettlementOrdersCount ?? 0 })}
            </p>
          </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              {t("cyclistWallet.cashToRemit")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              {t("cyclistWallet.pendingCashOrders", { count: summary?.pendingCashSettlementOrdersCount ?? 0 })}
            </p>
            <Button
              className="w-full active:scale-95"
              onClick={() => {
                if ((summary?.pendingSettlementOrdersCount ?? 0) <= 0) {
                  toast.info(t("cyclistWallet.noPendingSettlementToast"));
                  return;
                }
                setIsQrOpen(true);
              }}
            >
              {t("cyclistWallet.handoverCash")}
            </Button>
          </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card>
          <CardHeader className="space-y-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" />
              {t("cyclistWallet.earningsHistory")}
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
              <p className="text-xs text-muted-foreground">{t("cyclistWallet.totalDeliveryFees")}</p>
              <p className="text-2xl font-semibold">{(earningsHistory?.totalEarningsMad ?? 0).toFixed(2)} MAD</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-2">
              <p className="text-xs text-muted-foreground">{t("cyclistWallet.completedDeliveries")}</p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(earningsHistory?.deliveries?.length ?? 0) === 0 ? (
                  <AppEmptyState
                    title={t("cyclistWallet.emptyPeriodTitle")}
                    subtitle={t("cyclistWallet.emptyPeriodSubtitle")}
                    className="py-5"
                  />
                ) : (
                  earningsHistory!.deliveries.map((delivery) => (
                    <div key={delivery.orderId} className="rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{t("cyclistWallet.orderPrefix")} #{delivery.orderId.slice(0, 8)}</p>
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
        </motion.div>
      </motion.div>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("cyclistWallet.cashHandoverQr")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t("cyclistWallet.fullCashToHandover")}</p>
              <p className="text-xl font-semibold">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
              <p className="text-[11px] text-muted-foreground">{t("cyclistWallet.cashHandoverHint")}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-5">
              <p className="text-sm font-medium text-foreground">{t("cyclistWallet.useVendorQrTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("cyclistWallet.useVendorQrHint")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}