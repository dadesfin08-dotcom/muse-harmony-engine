import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomerOrderDetails } from "@/lib/orders.functions";

export const Route = createFileRoute("/customer/order/$orderId")({
  component: CustomerOrderDetailsPage,
});

function CustomerOrderDetailsPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate({ from: "/customer/order/$orderId" });
  const getDetails = useServerFn(getCustomerOrderDetails);

  const customerPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.customerSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);

  const detailsQuery = useQuery({
    queryKey: ["customer", "order-details", orderId, customerPhoneNumber],
    enabled: Boolean(orderId && customerPhoneNumber),
    queryFn: () => getDetails({ data: { phoneNumber: customerPhoneNumber, orderId } }),
  });

  const order = detailsQuery.data;
  const orderDate = order ? new Date(order.createdAt) : null;

  const statusBadge = useMemo(() => {
    const status = order?.status ?? "new";
    if (status === "delivered") return { label: "Delivered", className: "bg-primary/15 text-primary border-primary/30" };
    if (status === "delivering") return { label: "Out for Delivery", className: "bg-accent/30 text-foreground border-border" };
    if (status === "preparing" || status === "ready") return { label: "Pending", className: "bg-secondary text-secondary-foreground border-border" };
    if (status === "cancelled") return { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/30" };
    return { label: "Pending", className: "bg-secondary text-secondary-foreground border-border" };
  }, [order?.status]);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Button
          variant="outline"
          className="sticky top-3 z-10"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
              return;
            }
            navigate({ to: "/customer/" });
          }}
        >
          <ArrowLeft className="size-4" />
          Back to My Orders
        </Button>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Order Details / Digital Receipt</h1>
              <p className="text-sm text-muted-foreground">{order ? `Order #${order.id.slice(0, 8).toUpperCase()}` : "Loading order..."}</p>
            </div>
            <Badge variant="outline" className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
          </div>

          {detailsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading receipt details...</p>
          ) : detailsQuery.isError || !order ? (
            <p className="text-sm text-destructive">Unable to load this order.</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border border-border">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                      <TableHead className="border-r border-border font-semibold">Product Name (اسم المنتوج)</TableHead>
                      <TableHead className="border-r border-border text-center font-semibold">Quantity (الكمية)</TableHead>
                      <TableHead className="border-r border-border text-right font-semibold">Unit Price (ثمن الوحدة)</TableHead>
                      <TableHead className="text-right font-semibold">Total Line Price (المجموع)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={`${order.id}-${index}`} className="border-b border-border last:border-b-0 hover:bg-transparent">
                        <TableCell className="border-r border-border text-foreground">{item.productName}</TableCell>
                        <TableCell className="border-r border-border text-center">{item.quantity}</TableCell>
                        <TableCell className="border-r border-border text-right">{item.unitPriceMad.toFixed(2)} MAD</TableCell>
                        <TableCell className="text-right font-medium">{item.lineTotalMad.toFixed(2)} MAD</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                    <span className="text-muted-foreground">Order Date</span>
                    <span className="text-right text-foreground">
                      {orderDate && !Number.isNaN(orderDate.getTime()) ? orderDate.toLocaleString() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-medium text-foreground">{order.paymentMethod === "Carnet" ? "Carnet" : "Cash"}</span>
                  </div>
                </div>

                <div className="w-full space-y-2 border-t border-border pt-3 text-sm sm:ml-auto sm:max-w-sm sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{order.subtotalMad.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{order.deliveryFeeMad.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                    <span>Grand Total</span>
                    <span>{order.grandTotalMad.toFixed(2)} MAD</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}