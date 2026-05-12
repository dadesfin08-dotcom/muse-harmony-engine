import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { MobileHeader } from "@/components/MobileHeader";
import { listActiveFlashDeals } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

type AppLanguage = "en" | "fr" | "ar";

type FlashDealProduct = {
  id: string;
  name: string;
  nameFr: string | null;
  nameAr: string | null;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  imageUrl: string | null;
  vendorPrice: number;
  flashSalePrice: number;
  flashSaleEndTime: string;
};

export const Route = createFileRoute("/customer/flash-deals")({
  component: FlashDealsPage,
});

function FlashDealsPage() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const fetchFlashDeals = useServerFn(listActiveFlashDeals);
  const addCartItem = useCustomerCartStore((state) => state.addItem);
  const increaseItem = useCustomerCartStore((state) => state.increaseItem);
  const decreaseItem = useCustomerCartStore((state) => state.decreaseItem);
  const cartItems = useCustomerCartStore((state) => state.items);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { neighborhoodId?: string };
      setNeighborhoodId(parsed.neighborhoodId ?? null);
    } catch {
      setNeighborhoodId(null);
    }
  }, []);

  const flashDealsQuery = useQuery({
    queryKey: ["customer", "flash-deals-page", neighborhoodId],
    queryFn: () => fetchFlashDeals({ data: { neighborhoodId: neighborhoodId! } }),
    enabled: !!neighborhoodId,
    refetchInterval: 10_000,
  });

  const deals = useMemo(() => {
    const rows = (flashDealsQuery.data ?? []) as FlashDealProduct[];
    return rows.map((row) => ({
      ...row,
      localizedName:
        language === "ar"
          ? row.nameAr || row.name
          : language === "fr"
            ? row.nameFr || row.name
            : row.name,
      discountPercent:
        row.vendorPrice > 0 ? Math.max(0, Math.round(((row.vendorPrice - row.flashSalePrice) / row.vendorPrice) * 100)) : 0,
    }));
  }, [flashDealsQuery.data, language]);

  const getCartQuantity = (productId: string) =>
    cartItems.find((item) => item.id === productId)?.quantity ?? 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 pb-8 pt-0 sm:px-6">
      <MobileHeader title={t("flashDeals.title")} fallbackTo="/customer" />

      {flashDealsQuery.isLoading ? (
        <section className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
          {t("loading", { defaultValue: "Loading flash deals..." })}
        </section>
      ) : deals.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">{t("flashDeals.emptyTitle", { defaultValue: "No flash deals right now" })}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("flashDeals.emptyHint", { defaultValue: "Check back soon for limited-time discounts." })}
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {deals.map((deal) => (
            <article key={deal.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="relative h-28 w-full bg-gray-50">
                <img
                  src={deal.imageUrl || fallbackProductImage}
                  alt={deal.localizedName}
                  className="h-full w-full object-contain object-center p-2"
                  loading="lazy"
                />
                <span className="absolute left-2 top-2 inline-flex rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  -{deal.discountPercent}%
                </span>
              </div>

              <div className="space-y-1.5 p-3">
                <span className="mb-1 inline-block rounded-sm bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                  {t("flashDeals.title", { defaultValue: "Flash Deal" })}
                </span>

                <div className="flex items-start justify-between gap-1.5">
                  <h2 className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold text-gray-900">{deal.localizedName}</h2>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">
                    <Package className="size-3" />
                    {deal.measurementUnit}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0">
                  <p className="text-xl font-extrabold text-red-600">
                    {Number(deal.flashSalePrice ?? 0)} <span className="text-xs font-medium text-gray-800">MAD</span>
                  </p>

                  {getCartQuantity(deal.id) > 0 ? (
                    <div className="flex items-center gap-1 rounded-full border border-red-200 px-1.5 py-1">
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-full bg-red-50 text-red-600"
                        onClick={() => decreaseItem(deal.id)}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="min-w-5 text-center text-xs font-semibold text-gray-900">{getCartQuantity(deal.id)}</span>
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-full bg-red-50 text-red-600"
                        onClick={() => increaseItem(deal.id)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                      onClick={() => {
                        addCartItem({
                          id: deal.id,
                          name: deal.localizedName,
                          price: Number(deal.flashSalePrice ?? 0),
                          measurementUnit: deal.measurementUnit,
                          image: deal.imageUrl || fallbackProductImage,
                          alt: deal.localizedName,
                        });

                        toast.success(t("products.add"), {
                          description: deal.localizedName,
                          duration: 1200,
                        });
                      }}
                    >
                      <ShoppingCart className="size-3.5" />
                      {t("products.add")}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}