import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { AppLanguage } from "@/lib/i18n";
import {
  changeAppLanguage,
  getIntlLocale,
  getLocaleDirection,
  localizeText,
  resolveAppLanguage,
  type LocalizedTextValue,
} from "@/lib/localization";
import type { TranslationNamespace, TranslationSchema } from "@/lib/i18n";

export function useAppLanguage() {
  const { i18n } = useTranslation();

  const language = useMemo(
    () => resolveAppLanguage(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );

  const direction = useMemo(() => getLocaleDirection(language), [language]);
  const isRtl = direction === "rtl";
  const intlLocale = useMemo(() => getIntlLocale(language), [language]);

  const setLanguage = useCallback(
    async (nextLanguage: AppLanguage) => {
      await changeAppLanguage(i18n, nextLanguage);
    },
    [i18n],
  );

  return {
    language,
    direction,
    isRtl,
    intlLocale,
    setLanguage,
  };
}

export function useLocalizedText() {
  const { language } = useAppLanguage();

  const getLocalizedText = useCallback(
    (values: LocalizedTextValue, fallback = "") => localizeText(language, values, fallback),
    [language],
  );

  return getLocalizedText;
}

type NamespaceKey<N extends TranslationNamespace> = keyof TranslationSchema[N] & string;

export function useNamespacedT<N extends TranslationNamespace>(namespace: N) {
  const { t } = useTranslation();

  return useCallback(
    (key: NamespaceKey<N>, options?: Record<string, unknown>) => t(`${namespace}.${key}`, options),
    [namespace, t],
  );
}
