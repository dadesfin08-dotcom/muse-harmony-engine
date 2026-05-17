type ProductFlashPricing = {
  isFlashSaleActive?: boolean | null;
  vendorPrice?: number | null;
  finalVendorPrice?: number | null;
  flashSalePrice?: number | null;
  finalFlashSalePrice?: number | null;
};

export function resolveProductDetailPricing(product: ProductFlashPricing | null | undefined) {
  const normalPrice = Number(product?.finalVendorPrice ?? product?.vendorPrice ?? 0);
  const flashPrice = Number(product?.finalFlashSalePrice ?? product?.flashSalePrice ?? normalPrice);
  const useFlash = Boolean(product?.isFlashSaleActive);

  return {
    effectivePrice: useFlash ? flashPrice : normalPrice,
    oldPrice: normalPrice,
    useFlash,
  };
}