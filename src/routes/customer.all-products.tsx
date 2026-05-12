import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Search, ShoppingCart, Plus } from "lucide-react";
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
  brand: string | null;
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
          <article key={product.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Link to="/product/$id" params={{ id: product.id }} className="block">
              <div className="aspect-square overflow-hidden rounded-xl bg-muted/40">
                <img
                  src={product.imageUrl || fallbackProductImage}
                  alt={product.localizedName}
                  className="h-full w-full object-contain object-center p-2"
                  loading="lazy"
                />
              </div>
              <div className="p-3 sm:p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                  {product.localizedBrand || "—"}
                </p>
                <h2 className="mt-1 line-clamp-2 text-sm font-bold text-foreground sm:text-base">
                  {product.localizedName}
                </h2>
                <span className="mt-2 inline-block rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {product.measurementValue != null ? `${product.measurementValue} ` : ""}
                  {product.measurementUnit}
                </span>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-lg font-extrabold text-primary">
                    {Number(product.vendorPrice ?? 0)}
                    <span className="ml-1 text-xs font-semibold text-primary/80">MAD</span>
                  </p>
                </div>
              </div>
            </Link>

            <div className="px-3 pb-3">
              <Button
                variant="hero"
                size="sm"
                className="w-full rounded-xl shadow-sm transition-colors hover:opacity-95"
                onClick={() => addToCart(product)}
              >
                <Plus className="size-4" />
                {t("products.add")}
              </Button>
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