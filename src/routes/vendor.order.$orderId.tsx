import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, MessageSquareText, Phone, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVendorOrderDetails } from "@/lib/orders.functions";
import { getLocalizedValue, withLocale } from "@/lib/localization";
import { useAppLanguage } from "@/hooks/use-localization";

export const Route = createFileRoute("/vendor/order/$orderId")({
  component: VendorOrderDetailsPage,
});

function VendorOrderDetailsPage() {
  const { t } = useTranslation();
  const { orderId } = Route.useParams();
  const navigate = useNavigate({ from: "/vendor/order/$orderId" });
  const { language: activeLanguage, direction } = useAppLanguage();
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
    queryKey: ["vendor", "order-details", orderId, vendorPhoneNumber, activeLanguage],
    enabled: Boolean(orderId && vendorPhoneNumber),
    queryFn: () => getDetails({ data: withLocale(activeLanguage, { phoneNumber: vendorPhoneNumber, orderId }) }),
  });

  const order = detailsQuery.data;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-4" dir={direction}>
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
          {t("vendorDashboard.orderFinancialDetails.backToWallet")}
        </Button>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 border-b border-border pb-3">
            <h1 className="text-lg font-semibold text-foreground">{t("vendorDashboard.orderFinancialDetails.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {order
                ? t("vendorDashboard.orderFinancialDetails.orderSummary", {
                    orderId: order.id.slice(0, 8),
                    customerName: getLocalizedValue(order.customerName, activeLanguage, order.customerName),
                  })
                : t("vendorDashboard.orderFinancialDetails.loadingOrder")}
            </p>
          </div>

          {detailsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.loadingDetails")}</p>
          ) : detailsQuery.isError || !order ? (
            <p className="text-sm text-destructive">{t("vendorDashboard.orderFinancialDetails.loadError")}</p>
          ) : (
            <>
              <section className="mb-4 rounded-lg border border-border bg-muted/10 p-4">
                <h2 className="mb-3 text-sm font-semibold text-foreground">{t("vendorDashboard.orderFinancialDetails.customerInformation")}</h2>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.fullName")}</p>
                      <p className="font-medium text-foreground">{getLocalizedValue(order.customerName, activeLanguage, order.customerName)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.phoneNumber")}</p>
                      {order.customerPhone && order.customerPhone !== "-" ? (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {order.customerPhone}
                        </a>
                      ) : (
                        <p className="font-medium text-foreground">-</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.address")}</p>
                      <p className="font-medium text-foreground">{getLocalizedValue(order.customerAddress, activeLanguage, order.customerAddress)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MessageSquareText className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.specialInstructions")}</p>
                      <p className="font-medium text-foreground">{getLocalizedValue(order.specialInstructions, activeLanguage, "") || t("vendorDashboard.orderFinancialDetails.none")}</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="overflow-hidden rounded-md border border-border">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                      <TableHead className="border-r border-border font-semibold text-start">{t("vendorDashboard.orderFinancialDetails.table.productName")}</TableHead>
                      <TableHead className="border-r border-border font-semibold text-center">{t("vendorDashboard.orderFinancialDetails.table.quantity")}</TableHead>
                      <TableHead className="border-r border-border font-semibold text-end">{t("vendorDashboard.orderFinancialDetails.table.unitPrice")}</TableHead>
                      <TableHead className="font-semibold text-end">{t("vendorDashboard.orderFinancialDetails.table.totalLinePrice")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={`${order.id}-${index}`} className="border-b border-border last:border-b-0 hover:bg-transparent">
                        <TableCell className="border-r border-border text-foreground">
                          <p className="font-medium">{getLocalizedValue(item.productName, activeLanguage, item.productName)}</p>
                          {item.selectedVariant ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{getLocalizedValue(item.selectedVariant, activeLanguage, item.selectedVariant)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="border-r border-border text-center">{item.quantity}</TableCell>
                        <TableCell className="border-r border-border text-end">{item.unitPriceMad.toFixed(2)} MAD</TableCell>
                        <TableCell className="text-end font-medium">{item.lineTotalMad.toFixed(2)} MAD</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 ms-auto w-full max-w-sm space-y-2 border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.subtotal")}</span>
                  <span>{order.subtotalMad.toFixed(2)} MAD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("vendorDashboard.orderFinancialDetails.deliveryFee")}</span>
                  <span>{order.deliveryFeeMad.toFixed(2)} MAD</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>{t("vendorDashboard.orderFinancialDetails.grandTotal")}</span>
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