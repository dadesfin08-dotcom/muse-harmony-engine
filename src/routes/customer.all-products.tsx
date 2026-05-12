import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Droplets, Heart, Leaf, Minus, Package, Search, ShieldCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/MobileHeader";
import { getCustomerCatalogByNeighborhood } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

type AppLanguage = "en" | "fr" | "ar";

type CatalogProduct = {
  id: string;
  name: string;
  nameFr: string | null;
  nameAr: string | null;
  brand?: string | null;
  brandNameEn?: string | null;
  brandNameFr?: string | null;
  brandNameAr?: string | null;
  measurementValue?: number | null;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  imageUrl: string | null;
  vendorPrice: number;
};

export const Route = createFileRoute("/customer/all-products")({
  component: AllProductsPage,
});

function AllProductsPage() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const [search, setSearch] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const fetchCatalogByNeighborhood = useServerFn(getCustomerCatalogByNeighborhood);
  const addCartItem = useCustomerCartStore((state) => state.addItem);
  const increaseItem = useCustomerCartStore((state) => state.increaseItem);
  const decreaseItem = useCustomerCartStore((state) => state.decreaseItem);
  const cartItems = useCustomerCartStore((state) => state.items);
  const openCart = useCustomerCartStore((state) => state.openCart);

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

  const catalogQuery = useInfiniteQuery({
    queryKey: ["all-products", neighborhoodId],
    queryFn: ({ pageParam }) =>
      fetchCatalogByNeighborhood({
        data: {
          neighborhoodId: neighborhoodId!,
          page: Number(pageParam),
          pageSize: 12,
        },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage?.hasMore ? allPages.length + 1 : undefined),
    enabled: !!neighborhoodId,
  });

  const localizedProducts = useMemo(() => {
    const rows = (catalogQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []) as CatalogProduct[];
    return rows.map((item) => ({
      ...item,
      localizedBrand:
        language === "ar"
          ? item.brandNameAr || item.brandNameEn || item.brand || ""
          : language === "fr"
            ? item.brandNameFr || item.brandNameEn || item.brand || ""
            : item.brandNameEn || item.brand || "",
      localizedName:
        language === "ar"
          ? item.nameAr || item.name
          : language === "fr"
            ? item.nameFr || item.name
            : item.name,
    }));
  }, [catalogQuery.data, language]);

  const normalizedSearch = search.trim().toLowerCase();
  const searchActive = normalizedSearch.length >= 3;

  const displayedProducts = useMemo(() => {
    if (!searchActive) return localizedProducts;
    return localizedProducts.filter((product) =>
      product.localizedName.toLowerCase().includes(normalizedSearch),
    );
  }, [localizedProducts, normalizedSearch, searchActive]);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const addToCart = (product: (typeof displayedProducts)[number]) => {
    addCartItem({
      id: product.id,
      name: product.localizedName,
      price: Number(product.vendorPrice ?? 0),
      measurementUnit: product.measurementUnit,
      image: product.imageUrl || fallbackProductImage,
      alt: product.localizedName,
    });

    toast.success(t("products.add"), {
      description: product.localizedName,
      duration: 1200,
    });
  };

  const getCartQuantity = (productId: string) =>
    cartItems.find((item) => item.id === productId)?.quantity ?? 0;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-8 pt-0 sm:px-6">
      <MobileHeader
        title={t("allProducts.title")}
        fallbackTo="/customer"
        rightSlot={
          <button
            type="button"
            onClick={openCart}
            className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground"
            aria-label={t("nav.cart")}
          >
            <ShoppingCart className="size-5" />
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {cartCount}
            </span>
          </button>
        }
      />

      <div className="sticky top-0 z-20 mb-4 space-y-2 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
            placeholder={t("allProducts.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        {!searchActive && search.trim().length > 0 ? (
          <p className="text-xs text-muted-foreground">{t("allProducts.searchHint")}</p>
        ) : null}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {displayedProducts.map((product) => (
          <article key={product.id} className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white pb-2 shadow-sm">
            <Link to="/customer/product/$id" params={{ id: product.id }} className="block">
              <div className="relative">
                <img
                  src={product.imageUrl || fallbackProductImage}
                  alt={product.localizedName}
                  className="h-full w-full object-contain object-center"
                  loading="lazy"
                />
              </div>
            </Link>

            <button
              type="button"
              aria-label="Wishlist"
              className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-white shadow-sm"
            >
              <Heart className="size-4 text-teal-700" />
            </button>

            <div className="p-4">
              <span className="mb-2 inline-block rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                {product.localizedBrand || "—"}
              </span>

              <div className="flex items-start justify-between gap-2">
                <Link to="/customer/product/$id" params={{ id: product.id }} className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-lg font-bold text-gray-900">{product.localizedName}</h2>
                </Link>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-700">
                  <Package className="size-3.5" />
                  {product.measurementValue != null ? `${product.measurementValue} ` : ""}
                  {product.measurementUnit}
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-500">100% طبيعي | جودة عالية</p>

              <hr className="my-4 border-t border-dashed border-gray-200" />

              <div className="flex items-center justify-between gap-2">
                <p className="text-3xl font-extrabold text-[#2A7543]">
                  {Number(product.vendorPrice ?? 0)} <span className="text-sm font-medium">MAD</span>
                </p>

                {getCartQuantity(product.id) > 0 ? (
                  <div className="flex items-center rounded-full border border-gray-200 px-3 py-1">
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center text-[#2A7543]"
                      onClick={() => decreaseItem(product.id)}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-7 text-center text-base font-medium text-gray-900">{getCartQuantity(product.id)}</span>
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center text-[#2A7543]"
                      onClick={() => increaseItem(product.id)}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full bg-[#2A7543] px-5 py-2 text-white transition hover:bg-green-800"
                    onClick={() => addToCart(product)}
                  >
                    <ShoppingCart className="size-4" />
                    {t("products.add")}
                  </button>
                )}
              </div>
            </div>

            <div className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-[#F7FBF8] p-2 text-[10px] text-green-800">
              <span className="inline-flex items-center gap-1">
                <Leaf className="size-3" />
                100% طبيعي
              </span>
              <span className="inline-flex items-center gap-1">
                <Droplets className="size-3" />
                نقي وصحي
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3" />
                جودة مضمونة
              </span>
            </div>
          </article>
        ))}
      </section>

      {catalogQuery.hasNextPage ? (
        <div className="mt-5 flex justify-center">
          <Button
            variant="outline"
            className="rounded-xl px-6"
            onClick={() => catalogQuery.fetchNextPage()}
            disabled={catalogQuery.isFetchingNextPage}
          >
            {catalogQuery.isFetchingNextPage ? "..." : t("products.loadMore")}
          </Button>
        </div>
      ) : null}
    </main>
  );
}