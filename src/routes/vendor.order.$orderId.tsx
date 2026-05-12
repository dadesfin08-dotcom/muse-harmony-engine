import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVendorOrderDetails } from "@/lib/orders.functions";

export const Route = createFileRoute("/vendor/order/$orderId")({
  component: VendorOrderDetailsPage,
});

function VendorOrderDetailsPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate({ from: "/vendor/order/$orderId" });
  const getDetails = useServerFn(getVendorOrderDetails);

  const vendorPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.vendorSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);

  const detailsQuery = useQuery({
    queryKey: ["vendor", "order-details", orderId, vendorPhoneNumber],
    enabled: Boolean(orderId && vendorPhoneNumber),
    queryFn: () => getDetails({ data: { phoneNumber: vendorPhoneNumber, orderId } }),
  });

  const order = detailsQuery.data;

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
            navigate({ to: "/vendor/wallet" });
          }}
        >
          <ArrowLeft className="size-4" />
          Back to Credit/Wallet
        </Button>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 border-b border-border pb-3">
            <h1 className="text-lg font-semibold text-foreground">Order Financial Details</h1>
            <p className="text-sm text-muted-foreground">
              {order ? `Order #${order.id.slice(0, 8)} · ${order.customerName}` : "Loading order..."}
            </p>
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
                      <TableHead className="border-r border-border font-semibold text-center">
                        Quantity (الكمية / شحال من قطعة)
                      </TableHead>
                      <TableHead className="border-r border-border font-semibold text-right">Unit Price (ثمن الوحدة)</TableHead>
                      <TableHead className="font-semibold text-right">Total Line Price (الثمن الكلي)</TableHead>
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

              <div className="mt-4 ml-auto w-full max-w-sm space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{order.subtotalMad.toFixed(2)} MAD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Delivery Fee (ثمن التوصيل)</span>
                  <span>{order.deliveryFeeMad.toFixed(2)} MAD</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Grand Total (المجموع)</span>
                  <span>{order.grandTotalMad.toFixed(2)} MAD</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}