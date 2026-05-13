import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { MobileHeader } from "@/components/MobileHeader";
import { ProductCard } from "@/components/ProductCard";
import { listActiveFlashDeals } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";

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
            <ProductCard
              key={deal.id}
              id={deal.id}
              name={deal.localizedName}
              brand={t("flashDeals.title", { defaultValue: "Flash Deal" })}
              measurementUnit={deal.measurementUnit}
              imageUrl={deal.imageUrl}
              price={Number(deal.flashSalePrice ?? 0)}
              oldPrice={Number(deal.vendorPrice ?? 0)}
              discountPercent={deal.discountPercent}
              isFlashDeal
              cartQuantity={getCartQuantity(deal.id)}
              addLabel={t("products.add")}
              onAdd={() => {
                addCartItem({
                  id: deal.id,
                  name: deal.localizedName,
                  price: Number(deal.flashSalePrice ?? 0),
                  measurementUnit: deal.measurementUnit,
                  image: deal.imageUrl || "",
                  alt: deal.localizedName,
                });

                toast.success(t("products.add"), {
                  description: deal.localizedName,
                  duration: 1200,
                });
              }}
              onIncrease={() => increaseItem(deal.id)}
              onDecrease={() => decreaseItem(deal.id)}
            />
          ))}
        </section>
      )}
    </main>
  );
}