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
  const strikeSuggestion = profile
    ? profile.strikes >= 5
      ? "Suggested action: Block"
      : profile.strikes >= 3
        ? "Suggested action: Suspend"
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
                    <DropdownMenuItem onClick={() => onAction("vip")}>Mark as VIP</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("warning")}>Add Warning</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("suspend")}>Suspend Account</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction("block")}>Block Account</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className={cn("mt-2 flex items-center gap-2", isRtl && "justify-end")}>
                <Badge variant="secondary">{profile.status}</Badge>
                <Badge variant={profile.riskScore === "high" ? "destructive" : "outline"}>{profile.riskScore}</Badge>
              </div>
            </SheetHeader>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Total Spent" value={formatMad(profile.metrics.totalSpent, intlLocale)} />
              <Metric label="AOV" value={formatMad(profile.metrics.averageOrderValue, intlLocale)} />
              <Metric label="Total Orders" value={String(profile.metrics.totalOrders)} />
              <Metric label="Cancellation Rate" value={`${profile.metrics.cancellationRate.toFixed(1)}%`} />
              <Metric label="COD Rejections" value={String(profile.metrics.codRejections)} />
              <Metric label="Strikes" value={String(profile.strikes)} />
            </div>

            <Tabs defaultValue="risk" className="space-y-4">
              <TabsList className={cn("grid w-full grid-cols-3", isRtl && "text-right")}>
                <TabsTrigger value="risk">Risk Management</TabsTrigger>
                <TabsTrigger value="notes">Admin Notes</TabsTrigger>
                <TabsTrigger value="orders">Order History</TabsTrigger>
              </TabsList>

              <TabsContent value="risk" className="space-y-3">
                <div className={cn("flex flex-wrap items-center gap-2", isRtl && "flex-row-reverse justify-end")}>
                  <Button variant="outline" disabled={isUpdatingState} onClick={() => onAdjustStrike("add")}>+ Add Strike</Button>
                  <Button variant="outline" disabled={isUpdatingState || profile.strikes <= 0} onClick={() => onAdjustStrike("remove")}>
                    - Remove Strike
                  </Button>
                  <Button variant="outline" disabled={isUpdatingState || profile.strikes <= 0} onClick={() => onAdjustStrike("reset")}>
                    Reset
                  </Button>
                </div>
                {strikeSuggestion ? <p className="text-sm font-medium text-destructive">{strikeSuggestion}</p> : null}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3">
                <Textarea value={notesDraft} onChange={(event) => onNotesDraftChange(event.target.value)} className="min-h-28" />
                <Button onClick={onSaveNotes} disabled={isSavingNotes}>Save Internal Note</Button>
              </TabsContent>

              <TabsContent value="orders">
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profile.recentOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>#{order.id.slice(0, 8)}</TableCell>
                          <TableCell>{new Date(order.createdAt).toLocaleDateString(intlLocale)}</TableCell>
                          <TableCell className="capitalize">{order.status}</TableCell>
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
