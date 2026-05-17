import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart, Minus, Package, Plus, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

type MeasurementUnit = "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";

type ProductCardProps = {
  id: string;
  name: string;
  brand: string;
  measurementUnit: MeasurementUnit;
  measurementValue?: number | null;
  imageUrl: string | null;
  price: number;
  cartQuantity: number;
  selectedVariant?: string | null;
  productVariants?: string[];
  addLabel: string;
  isFlashDeal?: boolean;
  oldPrice?: number | null;
  discountPercent?: number;
  onAdd: (selectedVariant?: string | null) => void;
  onIncrease: (selectedVariant?: string | null) => void;
  onDecrease: (selectedVariant?: string | null) => void;
};

export function ProductCard({
  id,
  name,
  brand,
  measurementUnit,
  measurementValue,
  imageUrl,
  price,
  cartQuantity,
  selectedVariant = null,
  productVariants = [],
  addLabel,
  isFlashDeal = false,
  oldPrice,
  discountPercent = 0,
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const normalizedVariants = useMemo(
    () =>
      productVariants
        .map((variant) => (typeof variant === "string" ? variant.trim() : ""))
        .filter((variant) => variant.length > 0),
    [productVariants],
  );

  const [variantValue, setVariantValue] = useState<string>(selectedVariant ?? normalizedVariants[0] ?? "");

  useEffect(() => {
    if (selectedVariant && normalizedVariants.includes(selectedVariant)) {
      setVariantValue(selectedVariant);
      return;
    }

    if (normalizedVariants.length > 0 && !normalizedVariants.includes(variantValue)) {
      setVariantValue(normalizedVariants[0] ?? "");
      return;
    }

    if (normalizedVariants.length === 0) {
      setVariantValue("");
    }
  }, [normalizedVariants, selectedVariant, variantValue]);

  const resolvedVariant = normalizedVariants.length > 0 ? variantValue || normalizedVariants[0] : null;

  return (
    <article
      className={cn(
        "flex h-full min-h-[320px] flex-col overflow-hidden border border-gray-100 bg-white shadow-sm",
        isFlashDeal ? "rounded-3xl pb-1" : "rounded-xl",
      )}
    >
      <Link to="/customer/product/$id" params={{ id }} className={cn("block", isFlashDeal ? "" : "px-3 pt-3")}>
        <div className={cn("relative aspect-square w-full overflow-hidden", isFlashDeal ? "rounded-t-2xl" : "rounded-2xl bg-gray-50")}>
          <img
            src={imageUrl || fallbackProductImage}
            alt={name}
            className={cn(
              "h-full w-full",
              isFlashDeal ? "object-cover object-center" : "object-contain object-center p-2.5",
            )}
            loading="lazy"
          />
          {isFlashDeal ? (
            <button
              type="button"
              aria-label="Wishlist"
              className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-white shadow-sm"
            >
              <Heart className="size-4 text-teal-700" />
            </button>
          ) : null}
          {isFlashDeal && discountPercent > 0 ? (
            <span className="absolute left-2 top-2 inline-flex rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              -{discountPercent}%
            </span>
          ) : null}
        </div>
      </Link>

      <div className={cn("flex flex-1 flex-col space-y-1.5", isFlashDeal ? "h-full p-4" : "p-3 pt-2")}>
        {normalizedVariants.length > 0 ? (
          <select
            value={resolvedVariant ?? ""}
            onChange={(event) => setVariantValue(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
            aria-label={`Select variant for ${name}`}
          >
            {normalizedVariants.map((variant) => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
        ) : null}

        <div className="mb-1 flex w-full flex-row items-center justify-between">
          <span className="inline-block rounded-sm bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            {brand || "—"}
          </span>

          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">
            <Package className="size-3" />
            {measurementValue != null ? `${measurementValue} ` : ""}
            {measurementUnit}
          </span>
        </div>

        <Link to="/customer/product/$id" params={{ id }} className="block w-full min-w-0">
          <h2 title={name} className="h-[2.75rem] w-full text-base font-bold line-clamp-2">
            {name}
          </h2>
        </Link>

        <div className="mt-auto flex w-full flex-row items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-1 flex-col items-start justify-end">
            <div className="flex flex-wrap items-baseline gap-1">
              <span className={cn("text-lg font-bold", isFlashDeal ? "text-red-600" : "text-[#2A7543]")}>
                {Number(price ?? 0).toFixed(2)}
              </span>
              <span className={cn("text-xs font-bold", isFlashDeal ? "text-red-600" : "text-[#2A7543]")}>MAD</span>
            </div>

            {isFlashDeal && oldPrice != null ? (
              <span className="text-xs text-gray-400 line-through">{Number(oldPrice).toFixed(2)} MAD</span>
            ) : null}

            {isFlashDeal && discountPercent > 0 ? (
              <span className="inline-flex rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                -{discountPercent}%
              </span>
            ) : null}
          </div>

          <div className="flex min-w-[70px] shrink-0 justify-end">
            {cartQuantity > 0 ? (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1",
                  isFlashDeal ? "border border-red-200" : "border border-gray-200",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full",
                    isFlashDeal ? "bg-red-50 text-red-600" : "bg-gray-100 text-[#2A7543]",
                  )}
                  onClick={() => onDecrease(resolvedVariant)}
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-3" />
                </button>
                <span className="min-w-5 text-center text-xs font-semibold text-gray-900">{cartQuantity}</span>
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full",
                    isFlashDeal ? "bg-red-50 text-red-600" : "bg-gray-100 text-[#2A7543]",
                  )}
                  onClick={() => onIncrease(resolvedVariant)}
                  aria-label="Increase quantity"
                >
                  <Plus className="size-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors",
                  isFlashDeal ? "bg-red-600 hover:bg-red-700" : "bg-[#2A7543] hover:bg-green-800",
                )}
                onClick={() => onAdd(resolvedVariant)}
              >
                <ShoppingCart className="size-3.5" />
                {addLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}