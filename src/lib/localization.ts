import type { i18n as I18nInstance } from "i18next";

import {
  LANGUAGE_STORAGE_KEY,
  supportedLanguages,
  type AppLanguage,
  type TranslationNamespace,
} from "@/lib/i18n";

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export const LOCALE_CONFIG = {
  ar: { direction: "rtl", intl: "ar-MA" },
  fr: { direction: "ltr", intl: "fr-FR" },
  en: { direction: "ltr", intl: "en-US" },
} as const;

export type LocaleDirection = (typeof LOCALE_CONFIG)[AppLanguage]["direction"];
export type IntlLocaleCode = (typeof LOCALE_CONFIG)[AppLanguage]["intl"];

export type NamespacedTranslationKey<N extends TranslationNamespace = TranslationNamespace> = `${N}.${string}`;

export type LocalizedTextValue = {
  en?: string | null;
  fr?: string | null;
  ar?: string | null;
};

export function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  if (!value) return false;
  return (supportedLanguages as readonly string[]).includes(value);
}

export function resolveAppLanguage(value: string | null | undefined): AppLanguage {
  if (isSupportedLanguage(value)) {
    return value;
  }

  return DEFAULT_LANGUAGE;
}

export function getLocaleDirection(language: AppLanguage): LocaleDirection {
  return LOCALE_CONFIG[language].direction;
}

export function getIntlLocale(language: AppLanguage): IntlLocaleCode {
  return LOCALE_CONFIG[language].intl;
}

export function persistLanguagePreference(language: AppLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function applyLanguageToDocument(language: AppLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dir = getLocaleDirection(language);
}

export async function changeAppLanguage(i18n: I18nInstance, nextLanguage: AppLanguage) {
  if (!isSupportedLanguage(nextLanguage)) return;
  await i18n.changeLanguage(nextLanguage);
}

export function localizeText(
  language: AppLanguage,
  values: LocalizedTextValue,
  fallback = "",
): string {
  const normalized = {
    en: values.en?.trim() ?? "",
    fr: values.fr?.trim() ?? "",
    ar: values.ar?.trim() ?? "",
  };

  if (language === "ar") return normalized.ar || normalized.fr || normalized.en || fallback;
  if (language === "fr") return normalized.fr || normalized.en || normalized.ar || fallback;
  return normalized.en || normalized.fr || normalized.ar || fallback;
}

export function withLocale<TInput extends object>(language: AppLanguage, input: TInput): TInput & { locale: AppLanguage } {
  return {
    ...input,
    locale: language,
  };
}
