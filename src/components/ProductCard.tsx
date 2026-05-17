import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Heart, Minus, Package, Plus, ShoppingCart } from "lucide-react";

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
  flashDealContext?: boolean;
  oldPrice?: number | null;
  discountPercent?: number;
  premiumGrid?: boolean;
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
  flashDealContext = false,
  oldPrice,
  discountPercent = 0,
  premiumGrid = false,
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
        "flex flex-col h-full bg-white rounded-2xl overflow-hidden border-transparent ring-1 ring-black/5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)]",
        premiumGrid ? "" : "min-h-[320px]",
        isFlashDeal ? "pb-1" : "",
      )}
    >
      <Link
        to="/customer/product/$id"
        params={{ id }}
        search={(prev: Record<string, unknown>) => (flashDealContext ? { ...prev, deal: true } : prev)}
        className={cn("block", isFlashDeal ? "" : premiumGrid ? "" : "px-3 pt-3")}
      >
        <div
          className={cn(
            "relative w-full aspect-square overflow-hidden",
            "bg-slate-50",
            premiumGrid ? "" : isFlashDeal ? "rounded-t-2xl" : "rounded-2xl",
          )}
        >
          <img
            src={imageUrl || fallbackProductImage}
            alt={name}
            className={cn(
              "h-full w-full",
              premiumGrid ? "object-cover object-center" : isFlashDeal ? "object-cover object-center" : "object-contain object-center p-2.5",
            )}
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/70 to-transparent" />
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

      <div className={cn("flex flex-col flex-1 p-3", isFlashDeal ? "h-full p-4" : premiumGrid ? "" : "pt-2") }>
        {normalizedVariants.length > 0 ? (
          <div className="relative mb-2">
            <select
              value={resolvedVariant ?? ""}
              onChange={(event) => setVariantValue(event.target.value)}
              className="appearance-none w-full bg-slate-50/80 backdrop-blur-sm border-0 ring-1 ring-slate-900/5 text-slate-700 text-xs font-semibold rounded-xl px-3 py-1.5 pr-8 cursor-pointer outline-none hover:bg-slate-100 transition-colors"
              aria-label={`Select variant for ${name}`}
            >
              {normalizedVariants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
          </div>
        ) : null}

        <div className="flex justify-between items-center w-full mb-1">
          <span className="inline-block bg-emerald-500/10 text-emerald-700 font-extrabold px-2.5 py-1 rounded-md text-[10px] tracking-widest uppercase border border-emerald-500/10">
            {brand || "—"}
          </span>

          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">
            <Package className="size-3" />
            {measurementValue != null ? `${measurementValue} ` : ""}
            {measurementUnit}
          </span>
        </div>

        <Link
          to="/customer/product/$id"
          params={{ id }}
          search={(prev: Record<string, unknown>) => (flashDealContext ? { ...prev, deal: true } : prev)}
          className="block w-full min-w-0"
        >
          <h2 title={name} className="text-sm font-bold leading-tight line-clamp-2 min-h-[2.5rem] mb-2">
            {name}
          </h2>
        </Link>

        <div className="flex flex-row flex-wrap justify-between items-center w-full mt-auto gap-2">
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
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-white font-bold rounded-xl px-4 py-2 shadow-lg active:scale-95 transition-all duration-200",
                  isFlashDeal ? "bg-red-600 shadow-red-600/30 hover:bg-red-700" : "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700",
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