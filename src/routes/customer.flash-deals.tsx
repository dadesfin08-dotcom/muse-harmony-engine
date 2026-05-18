import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Heart, Minus, Package, Plus, Search, ShoppingCart } from "lucide-react";

import { MobileHeader } from "@/components/MobileHeader";
import { Input } from "@/components/ui/input";
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
  finalVendorPrice?: number;
  flashSalePrice: number;
  finalFlashSalePrice?: number;
  flashSaleEndTime: string;
};

export const Route = createFileRoute("/customer/flash-deals")({
  component: FlashDealsPage,
});

function FlashDealsPage() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const isArabic = language === "ar";
  const [searchTerm, setSearchTerm] = useState("");
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
        row.vendorPrice > 0
          ? Math.max(0, Math.round(((row.vendorPrice - row.flashSalePrice) / row.vendorPrice) * 100))
          : 0,
    }));
  }, [flashDealsQuery.data, language]);

  const filteredDeals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return deals;

    return deals.filter((deal) => {
      const searchable = [deal.name, deal.nameFr, deal.nameAr, deal.localizedName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [deals, searchTerm]);

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
        <section className="space-y-3.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ${isArabic ? "right-3" : "left-3"}`} />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("flashDeals.searchPlaceholder", { defaultValue: "Search flash deals" })}
              aria-label={t("flashDeals.searchAria", { defaultValue: "Search flash deals products" })}
              className={`h-11 bg-background/90 ${isArabic ? "pr-9 text-right" : "pl-9"}`}
            />
          </div>

          {filteredDeals.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("flashDeals.searchNoResults", { defaultValue: "No products match your search." })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDeals.map((deal) => {
            const cartQty = getCartQuantity(deal.id);
            const dealPrice = Number(deal.finalFlashSalePrice ?? deal.flashSalePrice ?? 0);
            const oldPrice = Number(deal.finalVendorPrice ?? deal.vendorPrice ?? 0);

            return (
              <article
                key={deal.id}
                className="group flex h-full min-h-[246px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-18px_rgba(15,23,42,0.55)]"
              >
                <Link
                  to="/customer/product/$id"
                  params={{ id: deal.id }}
                  search={(prev: Record<string, unknown>) => ({ ...prev, deal: true })}
                  className="relative block"
                  aria-label={deal.localizedName}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/25">
                    <img
                      src={deal.imageUrl || fallbackProductImage}
                      alt={deal.localizedName}
                      className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/18 to-transparent" />

                    {deal.discountPercent > 0 ? (
                      <span className="absolute left-2 top-2 inline-flex h-6 items-center rounded-full border border-red-200/70 bg-red-600/95 px-2 text-[10px] font-extrabold leading-none text-white shadow-sm">
                        -{deal.discountPercent}%
                      </span>
                    ) : null}

                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/90 text-muted-foreground shadow-sm backdrop-blur"
                    >
                      <Heart className="size-4" />
                    </span>
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-3.5">
                  <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary ${isArabic ? "self-end" : "self-start"}`}>
                    <Package className="size-3" />
                    <span>{t("flashDeals.title", { defaultValue: "Flash Deal" })}</span>
                  </div>

                  <h2
                    title={deal.localizedName}
                    className={`mt-2 line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-[1.2] text-foreground ${isArabic ? "text-right" : "text-left"}`}
                  >
                    {deal.localizedName}
                  </h2>

                  <p className={`mt-1 text-[11px] font-medium text-muted-foreground ${isArabic ? "text-right" : "text-left"}`}>
                    {deal.measurementUnit}
                  </p>

                  <div className={`mt-auto flex items-end justify-between gap-2 pt-3 ${isArabic ? "flex-row-reverse" : ""}`}>
                    <div className={`min-w-0 ${isArabic ? "text-right" : "text-left"}`}>
                      <div className={`flex items-baseline gap-1 ${isArabic ? "justify-end" : ""}`}>
                        <span className="text-[1.03rem] font-extrabold leading-none text-primary">{dealPrice.toFixed(2)}</span>
                        <span className="text-[11px] font-bold leading-none text-primary">MAD</span>
                      </div>
                      {oldPrice > dealPrice ? (
                        <span className="mt-0.5 block text-[11px] leading-none text-muted-foreground line-through">
                          {oldPrice.toFixed(2)} MAD
                        </span>
                      ) : null}
                    </div>

                    {cartQty > 0 ? (
                      <div className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-1.5 shadow-sm">
                        <button
                          type="button"
                          className="inline-flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
                          onClick={() => decreaseItem(deal.id)}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-5 text-center text-xs font-semibold text-foreground">{cartQty}</span>
                        <button
                          type="button"
                          className="inline-flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
                          onClick={() => increaseItem(deal.id)}
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_10px_18px_-12px_hsl(var(--primary)/0.75)] transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
                        onClick={() => {
                          addCartItem({
                            id: deal.id,
                            name: deal.localizedName,
                            price: dealPrice,
                            basePrice: Number(deal.flashSalePrice ?? 0),
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
              );
            })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}