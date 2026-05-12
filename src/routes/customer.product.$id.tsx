import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MobileHeader } from "@/components/MobileHeader";
import { getBrandSuggestionsForNeighborhood, getCustomerProductDetail } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

type AppLanguage = "en" | "fr" | "ar";

export const Route = createFileRoute("/customer/product/$id")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const fetchProductDetail = useServerFn(getCustomerProductDetail);
  const fetchBrandSuggestions = useServerFn(getBrandSuggestionsForNeighborhood);
  const addCartItem = useCustomerCartStore((state) => state.addItem);

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

  const productQuery = useQuery({
    queryKey: ["product-detail", id, neighborhoodId],
    queryFn: () =>
      fetchProductDetail({
        data: {
          productId: id,
          neighborhoodId,
        },
      }),
  });

  const product = productQuery.data;

  const localizedName = useMemo(() => {
    if (!product) return "";
    if (language === "ar") return product.nameAr || product.name;
    if (language === "fr") return product.nameFr || product.name;
    return product.name;
  }, [product, language]);

  const composedProductLabel = useMemo(() => {
    if (!product) return "";
    const localizedProductName = language === "ar" ? product.nameAr || product.name : language === "fr" ? product.nameFr || product.name : product.name;
    const brand = product.brand?.trim();
    const quantity = product.measurementValue != null ? `${product.measurementValue}` : null;
    const unit = product.measurementUnit || t("productDetail.unitFallback");
    const titleCore = brand ? `${brand} ${localizedProductName}` : localizedProductName;
    return `${titleCore} - ${quantity ? `${quantity} ` : ""}${unit}`;
  }, [product, language, t]);

  const suggestionsQuery = useQuery({
    queryKey: ["product-brand-suggestions", id, neighborhoodId, product?.brand],
    enabled: Boolean(product?.brand && neighborhoodId),
    queryFn: () =>
      fetchBrandSuggestions({
        data: {
          productId: id,
          neighborhoodId: neighborhoodId!,
          brand: product!.brand!,
        },
      }),
  });

  const formatSuggestedName = (item: {
    name: string;
    nameFr?: string | null;
    nameAr?: string | null;
    brand?: string | null;
    measurementValue?: number | null;
    measurementUnit: string;
  }) => {
    const localized = language === "ar" ? item.nameAr || item.name : language === "fr" ? item.nameFr || item.name : item.name;
    const head = item.brand?.trim() ? `${item.brand} ${localized}` : localized;
    return `${head} - ${item.measurementValue != null ? `${item.measurementValue} ` : ""}${item.measurementUnit}`;
  };

  const addToCart = () => {
    if (!product) return;

    addCartItem({
      id: product.id,
      name: localizedName,
      price: Number(product.vendorPrice ?? 0),
      measurementUnit: product.measurementUnit,
      image: product.imageUrl || fallbackProductImage,
      alt: composedProductLabel,
    });

    toast.success(t("products.add"), {
      description: localizedName,
      duration: 1200,
    });
  };

  const addSuggestedToCart = (item: {
    id: string;
    name: string;
    nameFr?: string | null;
    nameAr?: string | null;
    measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
    imageUrl?: string | null;
    vendorPrice: number;
  }) => {
    const name = formatSuggestedName(item);
    addCartItem({
      id: item.id,
      name,
      price: Number(item.vendorPrice ?? 0),
      measurementUnit: item.measurementUnit,
      image: item.imageUrl || fallbackProductImage,
      alt: name,
    });
    toast.success(t("products.add"), {
      description: name,
      duration: 1200,
    });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-28 pt-0 sm:px-6">
      <MobileHeader title={composedProductLabel || t("allProducts.title")} fallbackTo="/customer/all-products" />

      {!product ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("productDetail.notFound")}</p>
        </section>
      ) : (
        <section className="space-y-6">
          <Card className="overflow-hidden rounded-xl border-border/80 shadow-md">
            <CardContent className="p-0">
              <div className="aspect-square bg-muted/30">
                <img
                  src={product.imageUrl || fallbackProductImage}
                  alt={composedProductLabel}
                  className="h-full w-full object-contain object-center p-5"
                  loading="lazy"
                />
              </div>
              <div className="space-y-2 p-5">
                <p className="text-sm font-medium text-muted-foreground">{product.brand || ""}</p>
                <h2 className="text-xl font-semibold text-foreground">{composedProductLabel}</h2>
                <p className="text-lg font-semibold text-primary">
                  {Number(product.vendorPrice ?? 0)} MAD / {product.measurementValue != null ? `${product.measurementValue} ` : ""}
                  {product.measurementUnit}
                </p>
              </div>
            </CardContent>
          </Card>

          {(suggestionsQuery.data?.length ?? 0) > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("productDetail.moreFromBrand")}</h3>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {(suggestionsQuery.data ?? []).map((item) => {
                  const suggestionLabel = formatSuggestedName(item);
                  return (
                    <article
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void navigate({ to: "/customer/product/$id", params: { id: item.id } })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void navigate({ to: "/customer/product/$id", params: { id: item.id } });
                        }
                      }}
                      className="w-[220px] shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40"
                    >
                      <div className="aspect-square overflow-hidden rounded-lg bg-muted/40">
                        <img
                          src={item.imageUrl || fallbackProductImage}
                          alt={suggestionLabel}
                          className="h-full w-full object-contain object-center p-3"
                          loading="lazy"
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{suggestionLabel}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">{Number(item.vendorPrice ?? 0)} MAD</span>
                        <Button
                          size="sm"
                          variant="hero"
                          className="rounded-lg"
                          onClick={(event) => {
                            event.stopPropagation();
                            addSuggestedToCart(item);
                          }}
                        >
                          {t("productDetail.quickAdd")}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </section>
      )}

      {product ? (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-3xl px-4 sm:px-6 md:bottom-6">
          <Button variant="hero" size="lg" className="w-full rounded-xl" onClick={addToCart}>
            <Plus className="size-5" />
            {t("productDetail.addToCart")}
          </Button>
        </div>
      ) : null}
    </main>
  );
}