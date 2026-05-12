import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomerCarnetStatement } from "@/lib/carnet.functions";

export const Route = createFileRoute("/customer/carnet")({
  component: CustomerCarnetPage,
});

function CustomerCarnetPage() {
  const navigate = useNavigate({ from: "/customer/carnet" });
  const getStatement = useServerFn(getCustomerCarnetStatement);

  const customerPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.customerSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);

  const statementQuery = useQuery({
    queryKey: ["customer", "carnet-statement", customerPhoneNumber],
    enabled: Boolean(customerPhoneNumber),
    queryFn: () => getStatement({ data: { customerPhone: customerPhoneNumber } }),
  });

  const statement = statementQuery.data;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Button variant="outline" className="sticky top-3 z-10" onClick={() => navigate({ to: "/customer/" })}>
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="border-b border-border pb-3">
            <h1 className="text-lg font-semibold text-foreground">Carnet Details</h1>
            <p className="text-sm text-muted-foreground">Transparent statement of your unpaid credit purchases.</p>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">مجموع الكريدي · Total Outstanding Debt</p>
            <p className="mt-2 text-2xl font-bold text-destructive">
              {statement ? `${Number(statement.totalOutstandingDebtMad ?? 0).toFixed(2)} MAD` : "--"}
            </p>
          </div>

          {statementQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading carnet ledger...</p>
          ) : statementQuery.isError ? (
            <p className="mt-4 text-sm text-destructive">Unable to load carnet details.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-border">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="border-r border-border font-semibold">Order Date (تاريخ الطلب)</TableHead>
                    <TableHead className="border-r border-border font-semibold">Vendor Name (اسم المتجر)</TableHead>
                    <TableHead className="border-r border-border text-right font-semibold">Amount (المبلغ)</TableHead>
                    <TableHead className="text-center font-semibold">Status (الحالة)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(statement?.entries ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No unpaid carnet orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (statement?.entries ?? []).map((entry: any) => (
                      <TableRow
                        key={entry.orderId}
                        className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/20"
                        onClick={() => {
                          void navigate({ to: "/customer/order/$orderId", params: { orderId: entry.orderId } });
                        }}
                      >
                        <TableCell className="border-r border-border text-foreground">
                          {new Date(entry.orderDate).toLocaleString()}
                        </TableCell>
                        <TableCell className="border-r border-border text-foreground">{entry.vendorName}</TableCell>
                        <TableCell className="border-r border-border text-right font-medium">
                          {Number(entry.amountMad ?? 0).toFixed(2)} MAD
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                            Unpaid
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}