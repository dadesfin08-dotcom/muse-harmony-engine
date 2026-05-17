import type { AppLanguage } from "@/lib/i18n";

type LocalizedCategoryName = {
  name_en?: string | null;
  name_fr?: string | null;
  name_ar?: string | null;
  nameEn?: string | null;
  nameFr?: string | null;
  nameAr?: string | null;
};

export function getLocalizedCategoryName(category: LocalizedCategoryName, locale: AppLanguage): string {
  const en = category.name_en?.trim() || category.nameEn?.trim() || "";
  const fr = category.name_fr?.trim() || category.nameFr?.trim() || "";
  const ar = category.name_ar?.trim() || category.nameAr?.trim() || "";

  if (locale === "ar") return ar || fr || en;
  if (locale === "fr") return fr || en || ar;
  return en || fr || ar;
}