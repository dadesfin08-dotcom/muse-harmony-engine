import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomerOrderDetails } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/customer/order/$orderId")({
  component: CustomerOrderDetailsPage,
});

function CustomerOrderDetailsPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate({ from: "/customer/order/$orderId" });
  const getDetails = useServerFn(getCustomerOrderDetails);
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

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
    refetchInterval: order?.status === "delivering" ? 3500 : false,
  });

  const order = detailsQuery.data;
  const orderDate = order ? new Date(order.createdAt) : null;
  const language = (i18n.resolvedLanguage || i18n.language || "en") as "en" | "fr" | "ar";
  const isArabic = language === "ar";

  useEffect(() => {
    if (!orderId || !customerPhoneNumber) return;

    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "order-details", orderId, customerPhoneNumber] });
          void queryClient.invalidateQueries({ queryKey: ["customer", "orders", customerPhoneNumber] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [customerPhoneNumber, orderId, queryClient]);

  const copy = useMemo(() => {
    if (language === "ar") {
      return {
        back: "رجوع إلى طلباتي",
        title: "تفاصيل الطلب / الوصل الرقمي",
        loadingOrder: "جاري تحميل الطلب...",
        loadingReceipt: "جاري تحميل تفاصيل الوصل...",
        loadError: "تعذر تحميل هذا الطلب.",
        orderDate: "تاريخ الطلب",
        product: "اسم المنتوج",
        quantity: "الكمية",
        unitPrice: "ثمن الوحدة",
        lineTotal: "المجموع",
        subtotal: "المجموع الفرعي",
        deliveryFee: "ثمن التوصيل",
        grandTotal: "المجموع الإجمالي",
        paymentCash: "الدفع نقداً",
        paymentCarnet: "كريدي / كارني",
        statusPending: "قيد المعالجة",
        statusOutForDelivery: "خرج للتوصيل",
        statusDelivered: "تم التسليم",
        statusCancelled: "ملغى",
        handoverTitle: "رمز تأكيد التسليم",
        handoverHint: "ورّي هاد الرمز للسائق باش يأكد التسليم.",
        handoverDelivered: "تم تسليم الطلب بنجاح",
      };
    }

    if (language === "fr") {
      return {
        back: "Retour à mes commandes",
        title: "Détails de commande / Reçu numérique",
        loadingOrder: "Chargement de la commande...",
        loadingReceipt: "Chargement des détails du reçu...",
        loadError: "Impossible de charger cette commande.",
        orderDate: "Date de commande",
        product: "Nom du produit",
        quantity: "Quantité",
        unitPrice: "Prix unitaire",
        lineTotal: "Total ligne",
        subtotal: "Sous-total",
        deliveryFee: "Frais de livraison",
        grandTotal: "Total général",
        paymentCash: "Paiement cash",
        paymentCarnet: "Carnet / Crédit",
        statusPending: "En attente",
        statusOutForDelivery: "En livraison",
        statusDelivered: "Livrée",
        statusCancelled: "Annulée",
        handoverTitle: "Code QR de remise",
        handoverHint: "Présentez ce QR au livreur pour confirmer la remise.",
        handoverDelivered: "Commande livrée avec succès",
      };
    }

    return {
      back: "Back to My Orders",
      title: "Order Details / Digital Receipt",
      loadingOrder: "Loading order...",
      loadingReceipt: "Loading receipt details...",
      loadError: "Unable to load this order.",
      orderDate: "Order Date",
      product: "Product",
      quantity: "Quantity",
      unitPrice: "Unit Price",
      lineTotal: "Total",
      subtotal: "Subtotal",
      deliveryFee: "Delivery",
      grandTotal: "Grand Total",
      paymentCash: "Cash",
      paymentCarnet: "Carnet / Credit",
      statusPending: "Pending",
      statusOutForDelivery: "Out for Delivery",
      statusDelivered: "Delivered",
      statusCancelled: "Cancelled",
      handoverTitle: "Delivery handover QR",
      handoverHint: "Show this QR code to the driver to complete handover.",
      handoverDelivered: "Order Delivered Successfully",
    };
  }, [language]);

  const statusBadge = useMemo(() => {
    const status = order?.status ?? "new";
    if (status === "delivered") return { label: copy.statusDelivered, className: "bg-primary/15 text-primary border-primary/30" };
    if (status === "delivering" || status === "out_for_delivery") return { label: copy.statusOutForDelivery, className: "bg-accent/30 text-foreground border-border" };
    if (status === "preparing" || status === "ready") return { label: copy.statusPending, className: "bg-secondary text-secondary-foreground border-border" };
    if (status === "cancelled") return { label: copy.statusCancelled, className: "bg-destructive/10 text-destructive border-destructive/30" };
    return { label: copy.statusPending, className: "bg-secondary text-secondary-foreground border-border" };
  }, [copy.statusCancelled, copy.statusDelivered, copy.statusOutForDelivery, copy.statusPending, order?.status]);

  const isOutForDelivery = order?.status === "delivering" || order?.status === "out_for_delivery";
  const handoverQrPayload = useMemo(() => {
    if (!order?.id || !isOutForDelivery) return "";
    return JSON.stringify({ order_id: order.id, delivery_auth_code: order.deliveryAuthCode ?? null });
  }, [isOutForDelivery, order?.deliveryAuthCode, order?.id]);

  const paymentBadge = useMemo(() => {
    const normalized = String(order?.paymentMethod ?? "").trim().toLowerCase();
    if (normalized === "carnet" || normalized === "credit") {
      return {
        label: copy.paymentCarnet,
        className: "border-orange-300 bg-orange-100 text-orange-800",
      };
    }

    return {
      label: copy.paymentCash,
      className: "border-success/30 bg-success/10 text-success",
    };
  }, [copy.paymentCarnet, copy.paymentCash, order?.paymentMethod]);

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-muted/20 px-4 py-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Button
          variant="outline"
          className="sticky top-3 z-10 self-start"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
              return;
            }
            navigate({ to: "/customer/" });
          }}
        >
          <ArrowLeft className="size-4" />
          {copy.back}
        </Button>

        <section className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
              <p className="text-sm text-muted-foreground">{order ? `Order #${order.id.slice(0, 8).toUpperCase()}` : copy.loadingOrder}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={paymentBadge.className}>
                {paymentBadge.label}
              </Badge>
              <Badge variant="outline" className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
            </div>
          </div>

          {detailsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{copy.loadingReceipt}</p>
          ) : detailsQuery.isError || !order ? (
            <p className="text-sm text-destructive">{copy.loadError}</p>
          ) : (
            <>
              {isOutForDelivery ? (
                <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">{copy.handoverTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.handoverHint}</p>
                  <div className="mt-3 flex justify-center rounded-lg border border-border bg-background p-3">
                    <QRCodeSVG value={handoverQrPayload} size={184} includeMargin />
                  </div>
                </div>
              ) : order.status === "delivered" ? (
                <div className="mb-4 rounded-xl border border-success/30 bg-success/10 p-3">
                  <p className="inline-flex items-center text-sm font-semibold text-success">{copy.handoverDelivered}</p>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-md border border-border">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                      <TableHead className="border-r border-border font-semibold">{copy.product}</TableHead>
                      <TableHead className="border-r border-border text-center font-semibold">{copy.quantity}</TableHead>
                      <TableHead className="border-r border-border text-right font-semibold">{copy.unitPrice}</TableHead>
                      <TableHead className="text-right font-semibold">{copy.lineTotal}</TableHead>
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

              <div className="mt-4 border-t border-dashed border-border pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
                    <span className="text-muted-foreground">{copy.orderDate}</span>
                    <span className={`text-foreground ${isArabic ? "text-left" : "text-right"}`}>
                      {orderDate && !Number.isNaN(orderDate.getTime())
                        ? orderDate.toLocaleString(language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB")
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <span className="text-muted-foreground">{copy.deliveryFee}</span>
                    <span className="font-medium text-foreground">{order.deliveryFeeMad.toFixed(2)} MAD</span>
                  </div>
                </div>

                <div className="w-full space-y-2 text-sm sm:ml-auto sm:max-w-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{copy.subtotal}</span>
                    <span>{order.subtotalMad.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{copy.deliveryFee}</span>
                    <span>{order.deliveryFeeMad.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                    <span>{copy.grandTotal}</span>
                    <span>{order.grandTotalMad.toFixed(2)} MAD</span>
                  </div>
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