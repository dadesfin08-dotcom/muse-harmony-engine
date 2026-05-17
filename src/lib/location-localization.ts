import type { AppLanguage } from "@/lib/i18n";

type LocalizedLocationName = {
  name?: string | null;
  nameEn?: string | null;
  nameFr?: string | null;
  nameAr?: string | null;
};

export function getLocalizedCommuneName(location: LocalizedLocationName, locale: AppLanguage): string {
  const en = location.nameEn?.trim() || location.name?.trim() || "";
  const fr = location.nameFr?.trim() || "";
  const ar = location.nameAr?.trim() || "";

  if (locale === "ar") return ar || fr || en;
  if (locale === "fr") return fr || en || ar;
  return en || fr || ar;
}

export function getLocalizedNeighborhoodName(location: LocalizedLocationName, locale: AppLanguage): string {
  const en = location.nameEn?.trim() || location.name?.trim() || "";
  const fr = location.nameFr?.trim() || "";
  const ar = location.nameAr?.trim() || "";

  if (locale === "ar") return ar || fr || en;
  if (locale === "fr") return fr || en || ar;
  return en || fr || ar;
}
