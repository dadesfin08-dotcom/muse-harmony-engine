export function calculateMarkup(basePrice: number) {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  if (basePrice <= 5) return 0.5;
  if (basePrice <= 20) return 1;
  if (basePrice <= 100) return 2;
  return basePrice * 0.03;
}

export function calculateFinalPrice(basePrice: number, applyMarkup: boolean) {
  const normalizedBase = Number(basePrice ?? 0);
  const markup = applyMarkup ? calculateMarkup(normalizedBase) : 0;
  return {
    basePrice: normalizedBase,
    markup,
    finalPrice: normalizedBase + markup,
  };
}
