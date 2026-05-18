import { MoreHorizontal } from "lucide-react";

import { useAppLanguage } from "@/hooks/use-localization";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

type Profile = {
  id: string;
  fullName: string;
  phone: string;
  status: "active" | "vip" | "warning" | "suspicious" | "blocked";
  riskScore: "low" | "medium" | "high";
  strikes: number;
  codRejections: number;
  adminNotes: string;
  metrics: {
    totalSpent: number;
    averageOrderValue: number;
    totalOrders: number;
    cancellationRate: number;
    codRejections: number;
  };
  recentOrders: Array<{
    id: string;
    createdAt: string;
    status: string;
    amount: number;
  }>;
};

function formatMad(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} MAD`;
}

export function CustomerDrawer({
  open,
  profile,
  notesDraft,
  isSavingNotes,
  isUpdatingState,
  onOpenChange,
  onNotesDraftChange,
  onSaveNotes,
  onAdjustStrike,
  onAction,
}: {
  open: boolean;
  profile: Profile | null;
  notesDraft: string;
  isSavingNotes: boolean;
  isUpdatingState: boolean;
  onOpenChange: (open: boolean) => void;
  onNotesDraftChange: (value: string) => void;
  onSaveNotes: () => void;
  onAdjustStrike: (type: "add" | "remove" | "reset") => void;
  onAction: (action: "vip" | "warning" | "suspend" | "block") => void;
}) {
  const { intlLocale, isRtl } = useAppLanguage();
  const { t } = useTranslation();
  const localizedStatus = (status: Profile["status"]) => t(`admin.customersCrm.status.${status}`);
  const localizedRisk = (risk: Profile["riskScore"]) => t(`admin.customersCrm.risk.${risk}`);
  const localizedOrderStatus = (status: string) => t(`admin.ordersMonitoring.statuses.${status}`, { defaultValue: status });
  const strikeSuggestion = profile
    ? profile.strikes >= 5
      ? t("admin.customersCrm.drawer.suggestedBlock")
      : profile.strikes >= 3
        ? t("admin.customersCrm.drawer.suggestedSuspend")
        : null
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isRtl ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-2xl">
        {!profile ? null : (
          <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
            <SheetHeader className={cn("text-left", isRtl && "text-right")}>
              <div className={cn("flex items-start justify-between gap-3", isRtl && "flex-row-reverse")}>
                <div>
                  <SheetTitle>{profile.fullName}</SheetTitle>
                  <SheetDescription>{profile.phone}</SheetDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRtl ? "start" : "end"}>
                    <DropdownMenuItem onClick={() => onAction("vip")}>{t("admin.customersCrm.actions.markVip")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("warning")}>{t("admin.customersCrm.actions.addWarning")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("suspend")}>{t("admin.customersCrm.actions.suspend")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("block")}>{t("admin.customersCrm.actions.block")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className={cn("mt-2 flex items-center gap-2", isRtl && "justify-end")}>
                <Badge variant="secondary">{localizedStatus(profile.status)}</Badge>
                <Badge variant={profile.riskScore === "high" ? "destructive" : "outline"}>{localizedRisk(profile.riskScore)}</Badge>
              </div>
            </SheetHeader>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label={t("admin.customersCrm.drawer.metrics.totalSpent")} value={formatMad(profile.metrics.totalSpent, intlLocale)} />
              <Metric label={t("admin.customersCrm.drawer.metrics.averageOrderValue")} value={formatMad(profile.metrics.averageOrderValue, intlLocale)} />
              <Metric label={t("admin.customersCrm.drawer.metrics.totalOrders")} value={String(profile.metrics.totalOrders)} />
              <Metric label={t("admin.customersCrm.drawer.metrics.cancellationRate")} value={`${profile.metrics.cancellationRate.toFixed(1)}%`} />
              <Metric label={t("admin.customersCrm.drawer.metrics.codRejections")} value={String(profile.metrics.codRejections)} />
              <Metric label={t("admin.customersCrm.drawer.metrics.strikes")} value={String(profile.strikes)} />
            </div>

            <Tabs defaultValue="risk" className="space-y-4">
              <TabsList className={cn("grid w-full grid-cols-3", isRtl && "text-right")}>
                <TabsTrigger value="risk">{t("admin.customersCrm.drawer.tabs.riskManagement")}</TabsTrigger>
                <TabsTrigger value="notes">{t("admin.customersCrm.drawer.tabs.adminNotes")}</TabsTrigger>
                <TabsTrigger value="orders">{t("admin.customersCrm.drawer.tabs.orderHistory")}</TabsTrigger>
              </TabsList>

              <TabsContent value="risk" className="space-y-3">
                <div className={cn("flex flex-wrap items-center gap-2", isRtl && "flex-row-reverse justify-end")}>
                  <Button variant="outline" disabled={isUpdatingState} onClick={() => onAdjustStrike("add")}>{t("admin.customersCrm.drawer.actions.addStrike")}</Button>
                  <Button variant="outline" disabled={isUpdatingState || profile.strikes <= 0} onClick={() => onAdjustStrike("remove")}>
                    {t("admin.customersCrm.drawer.actions.removeStrike")}
                  </Button>
                  <Button variant="outline" disabled={isUpdatingState || profile.strikes <= 0} onClick={() => onAdjustStrike("reset")}>
                    {t("admin.customersCrm.drawer.actions.reset")}
                  </Button>
                </div>
                {strikeSuggestion ? <p className="text-sm font-medium text-destructive">{strikeSuggestion}</p> : null}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3">
                <Textarea value={notesDraft} onChange={(event) => onNotesDraftChange(event.target.value)} className="min-h-28" />
                <Button onClick={onSaveNotes} disabled={isSavingNotes}>{t("admin.customersCrm.drawer.actions.saveInternalNote")}</Button>
              </TabsContent>

              <TabsContent value="orders">
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.customersCrm.drawer.table.order")}</TableHead>
                        <TableHead>{t("admin.customersCrm.drawer.table.date")}</TableHead>
                        <TableHead>{t("admin.customersCrm.drawer.table.status")}</TableHead>
                        <TableHead>{t("admin.customersCrm.drawer.table.amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profile.recentOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>#{order.id.slice(0, 8)}</TableCell>
                          <TableCell>{new Date(order.createdAt).toLocaleDateString(intlLocale)}</TableCell>
                          <TableCell>{localizedOrderStatus(order.status)}</TableCell>
                          <TableCell>{formatMad(order.amount, intlLocale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </article>
  );
}
