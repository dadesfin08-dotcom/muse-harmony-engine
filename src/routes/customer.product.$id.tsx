import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { getBrandSuggestionsForNeighborhood, getCustomerProductDetail } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { cn } from "@/lib/utils";

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
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const fetchProductDetail = useServerFn(getCustomerProductDetail);
  const fetchBrandSuggestions = useServerFn(getBrandSuggestionsForNeighborhood);
  const addCartItem = useCustomerCartStore((state) => state.addItem);
  const increaseCartItem = useCustomerCartStore((state) => state.increaseItem);
  const decreaseCartItem = useCustomerCartStore((state) => state.decreaseItem);
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

  useEffect(() => {
    const variants = Array.isArray((product as { productVariants?: string[] } | null)?.productVariants)
      ? ((product as { productVariants?: string[] }).productVariants ?? [])
          .map((variant) => (typeof variant === "string" ? variant.trim() : ""))
          .filter((variant) => variant.length > 0)
      : [];

    if (variants.length === 0) {
      setSelectedVariant(null);
      return;
    }

    setSelectedVariant((current) => (current && variants.includes(current) ? current : (variants[0] ?? null)));
  }, [product]);

  const localizedName = useMemo(() => {
    if (!product) return "";
    if (language === "ar") return product.nameAr || product.name;
    if (language === "fr") return product.nameFr || product.name;
    return product.name;
  }, [product, language]);

  const composedProductLabel = useMemo(() => {
    if (!product) return "";
    const localizedProductName =
      language === "ar" ? product.nameAr || product.name : language === "fr" ? product.nameFr || product.name : product.name;
    const brand = product.brand?.trim();
    const quantity = product.measurementValue != null ? `${product.measurementValue}` : null;
    const unit = product.measurementUnit || t("productDetail.unitFallback");
    const titleCore = brand ? `${brand} ${localizedProductName}` : localizedProductName;
    return `${titleCore} - ${quantity ? `${quantity} ` : ""}${unit}`;
  }, [product, language, t]);

  const measurementText = useMemo(() => {
    if (!product) return "";
    return `${product.measurementValue != null ? `${product.measurementValue} ` : ""}${product.measurementUnit}`;
  }, [product]);

  const productDescription = useMemo(() => {
    if (!product) return "";

    const source = product as {
      description?: string | null;
      descriptionAr?: string | null;
      descriptionFr?: string | null;
    };

    if (language === "ar") {
      return source.descriptionAr || source.description || "منتج بجودة عالية ومختار بعناية باش يوصل ليك طازج وبأفضل قيمة يومياً.";
    }

    if (language === "fr") {
      return source.descriptionFr || source.description || "Produit sélectionné avec soin pour une qualité fraîche et un usage quotidien.";
    }

    return source.description || "Carefully selected product with reliable quality, freshness, and everyday value.";
  }, [language, product]);

  const suggestionsQuery = useQuery({
    queryKey: ["product-brand-suggestions", id, neighborhoodId, product?.brandId],
    enabled: Boolean(product?.brandId && neighborhoodId),
    queryFn: () =>
      fetchBrandSuggestions({
        data: {
          productId: id,
          neighborhoodId: neighborhoodId!,
          brandId: product!.brandId!,
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

  const normalizedVariant = selectedVariant?.trim() || null;
  const cartItemId = product ? (normalizedVariant ? `${product.id}::${normalizedVariant}` : product.id) : "";
  const currentCartQuantity = useMemo(() => {
    if (!product) return 0;
    return cartItems.find((item) => (item.cartItemId || item.id) === cartItemId)?.quantity ?? 0;
  }, [cartItemId, cartItems, product]);

  const addToCart = () => {
    if (!product) return;

    addCartItem({
      id: product.id,
      cartItemId,
      productId: product.id,
      name: localizedName,
      selectedVariant: normalizedVariant,
      brandName: product.brand || null,
      measurementValue: product.measurementValue ?? null,
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
    <main className="mx-auto min-h-dvh w-full max-w-3xl bg-background pb-[210px]">
      {!product ? (
        <section className="px-4 pt-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("productDetail.notFound")}</p>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="relative z-10 w-full overflow-hidden rounded-b-[40px] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-b-[40px]"
              style={{
                boxShadow:
                  "inset 0 0 0 1px rgba(255,215,0,0.24), inset 0 0 46px rgba(255,215,0,0.18), 0 0 28px rgba(0,206,209,0.2), 0 0 42px rgba(255,215,0,0.18)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 rounded-b-[44px]"
              style={{
                background:
                  "linear-gradient(130deg, rgba(255,215,0,0.22) 0%, rgba(255,255,255,0.18) 22%, rgba(0,206,209,0.2) 52%, rgba(255,215,0,0.24) 100%)",
                filter: "blur(16px)",
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                  return;
                }

                void navigate({ to: "/customer/all-products" });
              }}
              aria-label={t("common.back", { defaultValue: "Back" })}
              className="absolute left-4 top-4 inline-flex rounded-full bg-white/80 p-2 text-slate-700 shadow-sm backdrop-blur"
            >
              <ArrowLeft className="size-5" />
            </button>

            <div className="relative mx-auto flex aspect-square w-full items-center justify-center">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[56%] -translate-x-1/2 -translate-y-1/2 rounded-[40%]"
                style={{
                  background:
                    "radial-gradient(circle at 48% 50%, rgba(255,255,255,0.58) 0%, rgba(255,215,0,0.34) 34%, rgba(0,206,209,0.2) 62%, rgba(255,215,0,0.06) 100%)",
                  filter: "blur(20px)",
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[13%] h-5 w-5 -translate-x-1/2 rounded-full"
                style={{
                  background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,215,0,0.65) 45%, rgba(255,255,255,0) 100%)",
                  filter: "blur(1px)",
                }}
              />
              <img
                src={product.imageUrl || fallbackProductImage}
                alt={composedProductLabel}
                className="relative z-10 max-h-full w-full object-contain object-center [filter:drop-shadow(0_10px_12px_rgba(0,0,0,0.18))_drop-shadow(0_0_10px_rgba(255,255,255,0.45))_drop-shadow(0_0_20px_rgba(255,215,0,0.22))_drop-shadow(0_0_28px_rgba(0,206,209,0.18))]"
                loading="lazy"
              />
            </div>
          </div>

          <div className="space-y-4 px-5 pb-2 pt-6">
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {product.brand || "—"}
            </span>

            <h1 className="text-pretty break-words text-2xl font-black leading-tight text-slate-900">{localizedName}</h1>

            <div className="flex items-end gap-3">
              <p className="text-3xl font-black text-emerald-600">{Number(product.vendorPrice ?? 0)} MAD</p>
              <p className="inline-flex items-center gap-1.5 pb-1 text-sm font-medium text-slate-500">
                <Package className="size-4" />
                {measurementText}
              </p>
            </div>

            {Array.isArray((product as { productVariants?: string[] }).productVariants) &&
            (product as { productVariants?: string[] }).productVariants!.length > 0 ? (
              <select
                value={selectedVariant ?? ""}
                onChange={(event) => setSelectedVariant(event.target.value || null)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
              >
                {(product as { productVariants?: string[] }).productVariants!
                  .map((variant) => (typeof variant === "string" ? variant.trim() : ""))
                  .filter((variant) => variant.length > 0)
                  .map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
              </select>
            ) : null}

            <section>
              <h3 className="mb-2 mt-6 text-lg font-bold text-slate-800">تفاصيل المنتج</h3>
              <p className="text-sm leading-relaxed text-slate-500">{productDescription}</p>
            </section>
          </div>

          {(suggestionsQuery.data?.length ?? 0) > 0 ? (
            <section className="mt-6 space-y-3 px-5 pb-32">
              <h2 className="text-base font-semibold text-foreground">{t("productDetail.moreFromBrand")}</h2>
              <div className="grid grid-cols-2 gap-4">
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
                      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
                    >
                      <div className="aspect-square overflow-hidden rounded-t-2xl bg-slate-50">
                        <img
                          src={item.imageUrl || fallbackProductImage}
                          alt={suggestionLabel}
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                      </div>

                      <div className="flex flex-col gap-1 p-3">
                        <p className="line-clamp-1 text-xs font-medium text-foreground">{suggestionLabel}</p>
                        <span className="text-sm font-bold text-emerald-600">{Number(item.vendorPrice ?? 0)} MAD</span>
                        <button
                          type="button"
                          className="mt-2 w-full rounded-lg bg-slate-100 py-1.5 text-xs font-bold text-emerald-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            addSuggestedToCart(item);
                          }}
                        >
                          {t("productDetail.quickAdd")}
                        </button>
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
        <div className="fixed inset-x-0 bottom-[70px] z-40 w-full">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 border-t border-slate-100 bg-white p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
            <div className="inline-flex h-12 items-center rounded-full border border-slate-200 bg-white px-1.5">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => {
                  if (currentCartQuantity > 1) {
                    decreaseCartItem(cartItemId);
                    return;
                  }

                  if (currentCartQuantity === 1) {
                    decreaseCartItem(cartItemId);
                    return;
                  }
                }}
                disabled={currentCartQuantity === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Minus className="size-4" />
              </button>

              <span className="min-w-8 text-center text-base font-bold text-slate-900">{currentCartQuantity}</span>

              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => {
                  if (currentCartQuantity > 0) {
                    increaseCartItem(cartItemId);
                    return;
                  }

                  addToCart();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={addToCart}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white transition",
                "hover:bg-emerald-700",
              )}
            >
              <ShoppingCart className="size-4" />
              {t("productDetail.addToCart")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}