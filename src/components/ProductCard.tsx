import { Link } from "@tanstack/react-router";
import { Minus, Package, Plus, ShoppingCart } from "lucide-react";

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
  addLabel: string;
  isFlashDeal?: boolean;
  oldPrice?: number | null;
  discountPercent?: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
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
  addLabel,
  isFlashDeal = false,
  oldPrice,
  discountPercent = 0,
  onAdd,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <Link to="/customer/product/$id" params={{ id }} className="block">
        <div className="relative h-28 w-full bg-gray-50">
          <img
            src={imageUrl || fallbackProductImage}
            alt={name}
            className="h-full w-full object-contain object-center p-2"
            loading="lazy"
          />
          {isFlashDeal && discountPercent > 0 ? (
            <span className="absolute left-2 top-2 inline-flex rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              -{discountPercent}%
            </span>
          ) : null}
        </div>
      </Link>

      <div className="space-y-1.5 p-3">
        <span className="mb-1 inline-block rounded-sm bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
          {brand || "—"}
        </span>

        <div className="flex items-start justify-between gap-1.5">
          <Link to="/customer/product/$id" params={{ id }} className="min-w-0 flex-1">
            <h2 className="line-clamp-1 text-sm font-semibold text-gray-900">{name}</h2>
          </Link>
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-gray-50 px-1.5 py-0.5 text-xs text-gray-400">
            <Package className="size-3" />
            {measurementValue != null ? `${measurementValue} ` : ""}
            {measurementUnit}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0">
          <div className={cn("flex items-center gap-1.5", isFlashDeal && "flex flex-wrap")}>
            <p className={cn("text-xl font-extrabold", isFlashDeal ? "text-red-600" : "text-[#2A7543]")}>
              {Number(price ?? 0)}{" "}
              <span className={cn("text-xs font-medium", isFlashDeal && "text-gray-800")}>MAD</span>
            </p>

            {isFlashDeal && oldPrice != null ? (
              <span className="text-xs text-gray-400 line-through">{Number(oldPrice)} MAD</span>
            ) : null}

            {isFlashDeal && discountPercent > 0 ? (
              <span className="inline-flex rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                -{discountPercent}%
              </span>
            ) : null}
          </div>

          {cartQuantity > 0 ? (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-1.5 py-1",
                isFlashDeal ? "border border-red-200" : "border border-gray-200",
              )}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full",
                  isFlashDeal ? "bg-red-50 text-red-600" : "bg-gray-100 text-[#2A7543]",
                )}
                onClick={onDecrease}
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
                onClick={onIncrease}
                aria-label="Increase quantity"
              >
                <Plus className="size-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors",
                isFlashDeal ? "bg-red-600 hover:bg-red-700" : "bg-[#2A7543] hover:bg-green-800",
              )}
              onClick={onAdd}
            >
              <ShoppingCart className="size-3.5" />
              {addLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}