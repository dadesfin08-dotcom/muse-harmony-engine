import { MoreHorizontal } from "lucide-react";

import { useAppLanguage } from "@/hooks/use-localization";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "react-i18next";

export type AdminCustomerRow = {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  joinedAt: string;
  totalOrders: number;
  ltvMad: number;
  status: "active" | "vip" | "warning" | "suspicious" | "blocked";
  riskScore: "low" | "medium" | "high";
  strikes: number;
  codRejections: number;
  adminNotes: string;
  systemTags: string[];
};

function formatMad(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} MAD`;
}

const statusBadgeVariant: Record<AdminCustomerRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  vip: "default",
  warning: "outline",
  suspicious: "destructive",
  blocked: "destructive",
};

const riskDotClass: Record<AdminCustomerRow["riskScore"], string> = {
  low: "bg-success",
  medium: "bg-accent",
  high: "bg-destructive",
};

function getSystemTagTone(tag: string) {
  if (tag === "عميل موثوق") return "bg-success/15 text-success border-success/30";
  if (tag === "عميل نشيط") return "bg-primary/15 text-primary border-primary/30";
  if (tag === "إلغاء متكرر") return "bg-accent/20 text-accent-foreground border-accent/40";
  if (tag === "سبام" || tag === "رفض COD") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

type Props = {
  customers: AdminCustomerRow[];
  isLoading: boolean;
  error: Error | null;
  searchInput: string;
  statusFilter: "all" | "active" | "vip" | "warning" | "suspicious" | "blocked";
  riskFilter: "all" | "low" | "medium" | "high";
  sortBy: "newest" | "highest_ltv" | "most_strikes";
  page: number;
  pageSize: number;
  total: number;
  onSearchInputChange: (value: string) => void;
  onStatusFilterChange: (value: Props["statusFilter"]) => void;
  onRiskFilterChange: (value: Props["riskFilter"]) => void;
  onSortByChange: (value: Props["sortBy"]) => void;
  onPageChange: (nextPage: number) => void;
  onOpenCustomer: (customerId: string) => void;
  onAction: (customerId: string, action: "vip" | "warning" | "suspend" | "block") => void;
};

export function CustomerTable(props: Props) {
  const { intlLocale, isRtl } = useAppLanguage();
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  const localizedStatus = (status: AdminCustomerRow["status"]) => t(`admin.customersCrm.status.${status}`);
  const localizedRisk = (risk: AdminCustomerRow["riskScore"]) => t(`admin.customersCrm.risk.${risk}`);

  if (props.error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        {t("admin.customersCrm.states.loadFailed")}
      </section>
    );
  }

  return (
    <section dir={isRtl ? "rtl" : "ltr"} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-end", isRtl && "lg:flex-row-reverse")}>
        <div className="w-full lg:max-w-md">
          <p className="mb-1 text-xs text-muted-foreground">{t("admin.customersCrm.search.label")}</p>
          <Input
            value={props.searchInput}
            onChange={(event) => props.onSearchInputChange(event.target.value)}
            placeholder={t("admin.customersCrm.search.placeholder")}
          />
        </div>
        <div className={cn("grid w-full gap-2 sm:grid-cols-3", isRtl && "text-right")}>
          <Select value={props.statusFilter} onValueChange={(value) => props.onStatusFilterChange(value as Props["statusFilter"])}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.customersCrm.filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.customersCrm.filters.allStatuses")}</SelectItem>
              <SelectItem value="active">{t("admin.customersCrm.status.active")}</SelectItem>
              <SelectItem value="vip">{t("admin.customersCrm.status.vip")}</SelectItem>
              <SelectItem value="warning">{t("admin.customersCrm.status.warning")}</SelectItem>
              <SelectItem value="suspicious">{t("admin.customersCrm.status.suspicious")}</SelectItem>
              <SelectItem value="blocked">{t("admin.customersCrm.status.blocked")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.riskFilter} onValueChange={(value) => props.onRiskFilterChange(value as Props["riskFilter"])}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.customersCrm.filters.risk")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.customersCrm.filters.allRiskLevels")}</SelectItem>
              <SelectItem value="low">{t("admin.customersCrm.risk.low")}</SelectItem>
              <SelectItem value="medium">{t("admin.customersCrm.risk.medium")}</SelectItem>
              <SelectItem value="high">{t("admin.customersCrm.risk.high")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.sortBy} onValueChange={(value) => props.onSortByChange(value as Props["sortBy"])}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.customersCrm.sort.label")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("admin.customersCrm.sort.newest")}</SelectItem>
              <SelectItem value="highest_ltv">{t("admin.customersCrm.sort.highestLtv")}</SelectItem>
              <SelectItem value="most_strikes">{t("admin.customersCrm.sort.mostStrikes")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.customersCrm.table.name")}</TableHead>
              <TableHead>{t("admin.customersCrm.table.contact")}</TableHead>
              <TableHead>{t("admin.customersCrm.table.orders")}</TableHead>
              <TableHead>{t("admin.customersCrm.table.ltv")}</TableHead>
              <TableHead>{t("admin.customersCrm.table.status")}</TableHead>
              <TableHead>{t("admin.customersCrm.table.riskLevel")}</TableHead>
              <TableHead className={cn(isRtl ? "text-left" : "text-right")}>{t("admin.customersCrm.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <AppEmptyState title={t("admin.customersCrm.states.loadingTitle")} subtitle={t("admin.customersCrm.states.loadingSubtitle")} className="border-0 bg-transparent py-2" />
                </TableCell>
              </TableRow>
            ) : props.customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <AppEmptyState title={t("admin.customersCrm.states.emptyTitle")} subtitle={t("admin.customersCrm.states.emptySubtitle")} className="border-0 bg-transparent py-2" />
                </TableCell>
              </TableRow>
            ) : (
              props.customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <button className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => props.onOpenCustomer(customer.id)}>
                      {customer.fullName}
                    </button>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground">{customer.phone}</p>
                    <p className="text-xs text-muted-foreground">{customer.address}</p>
                  </TableCell>
                  <TableCell>{customer.totalOrders}</TableCell>
                  <TableCell className="font-medium">{formatMad(customer.ltvMad, intlLocale)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[customer.status]}>{localizedStatus(customer.status)}</Badge>
                    {customer.systemTags.length > 0 ? (
                      <div className={cn("mt-2 flex flex-wrap gap-1", isRtl && "justify-end") }>
                        {customer.systemTags.map((tag) => (
                          <Badge key={`${customer.id}-${tag}`} variant="outline" className={cn("text-[10px]", getSystemTagTone(tag))}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", riskDotClass[customer.riskScore])} />
                      <span>{localizedRisk(customer.riskScore)}</span>
                    </span>
                  </TableCell>
                  <TableCell className={cn(isRtl ? "text-left" : "text-right")}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRtl ? "start" : "end"}>
                        <DropdownMenuItem onClick={() => props.onOpenCustomer(customer.id)}>{t("admin.customersCrm.actions.viewDetails")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "vip")}>{t("admin.customersCrm.actions.markVip")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "warning")}>{t("admin.customersCrm.actions.addWarning")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "suspend")}>{t("admin.customersCrm.actions.suspend")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "block")}>{t("admin.customersCrm.actions.block")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
        <p className="text-xs text-muted-foreground">
          {t("admin.customersCrm.pagination.pageOf", { page: props.page, totalPages })}
        </p>
        <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
          <Button variant="outline" size="sm" onClick={() => props.onPageChange(props.page - 1)} disabled={props.page <= 1}>
            {t("admin.customersCrm.pagination.previous")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => props.onPageChange(props.page + 1)} disabled={props.page >= totalPages}>
            {t("admin.customersCrm.pagination.next")}
          </Button>
        </div>
      </div>
    </section>
  );
}
