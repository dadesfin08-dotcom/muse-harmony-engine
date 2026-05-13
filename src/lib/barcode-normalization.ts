const ARABIC_INDIC_DIGIT_ZERO = "٠".charCodeAt(0);
const EASTERN_ARABIC_DIGIT_ZERO = "۰".charCodeAt(0);

function normalizeArabicDigits(input: string) {
  return input
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_INDIC_DIGIT_ZERO))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - EASTERN_ARABIC_DIGIT_ZERO));
}

export function normalizeBarcodeInput(value: string | null | undefined) {
  if (!value) return null;

  const normalized = normalizeArabicDigits(value.normalize("NFKC"))
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\s\-_./\\|,:;(){}\[\]]+/g, "")
    .trim()
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}
