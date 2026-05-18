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
  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));

  if (props.error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load customers.
      </section>
    );
  }

  return (
    <section dir={isRtl ? "rtl" : "ltr"} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-end", isRtl && "lg:flex-row-reverse")}>
        <div className="w-full lg:max-w-md">
          <p className="mb-1 text-xs text-muted-foreground">Global Search</p>
          <Input
            value={props.searchInput}
            onChange={(event) => props.onSearchInputChange(event.target.value)}
            placeholder="Search name, phone, address, customer ID"
          />
        </div>
        <div className={cn("grid w-full gap-2 sm:grid-cols-3", isRtl && "text-right")}>
          <Select value={props.statusFilter} onValueChange={(value) => props.onStatusFilterChange(value as Props["statusFilter"])}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="suspicious">Suspicious</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.riskFilter} onValueChange={(value) => props.onRiskFilterChange(value as Props["riskFilter"])}>
            <SelectTrigger>
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk Levels</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Select value={props.sortBy} onValueChange={(value) => props.onSortByChange(value as Props["sortBy"])}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="highest_ltv">Highest LTV</SelectItem>
              <SelectItem value="most_strikes">Most Strikes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>LTV</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <AppEmptyState title="Loading customers..." subtitle="Syncing CRM records." className="border-0 bg-transparent py-2" />
                </TableCell>
              </TableRow>
            ) : props.customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <AppEmptyState title="No customers found." subtitle="Adjust filters or wait for customer activity." className="border-0 bg-transparent py-2" />
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
                    <Badge variant={statusBadgeVariant[customer.status]}>{customer.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", riskDotClass[customer.riskScore])} />
                      <span className="capitalize">{customer.riskScore}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRtl ? "start" : "end"}>
                        <DropdownMenuItem onClick={() => props.onOpenCustomer(customer.id)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "vip")}>Mark as VIP</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "warning")}>Add Warning</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "suspend")}>Suspend Account</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => props.onAction(customer.id, "block")}>Block Account</DropdownMenuItem>
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
          Page {props.page} of {totalPages}
        </p>
        <div className={cn("flex items-center gap-2", isRtl && "flex-row-reverse")}>
          <Button variant="outline" size="sm" onClick={() => props.onPageChange(props.page - 1)} disabled={props.page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => props.onPageChange(props.page + 1)} disabled={props.page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
