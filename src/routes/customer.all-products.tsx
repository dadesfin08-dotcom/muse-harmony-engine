import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/MobileHeader";
import { ProductCard } from "@/components/ProductCard";
import { getCustomerCatalogByNeighborhood } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";

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
          <ProductCard
            key={product.id}
            id={product.id}
            name={product.localizedName}
            brand={product.localizedBrand || "—"}
            measurementValue={product.measurementValue}
            measurementUnit={product.measurementUnit}
            imageUrl={product.imageUrl}
            price={Number(product.vendorPrice ?? 0)}
            cartQuantity={getCartQuantity(product.id)}
            addLabel={t("products.add")}
            onAdd={() => addToCart(product)}
            onIncrease={() => increaseItem(product.id)}
            onDecrease={() => decreaseItem(product.id)}
          />
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