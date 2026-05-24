import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/hooks/useSettings";
import { toI18nCode } from "@/i18n";

/**
 * Thin wrapper around `useTranslation()` that keeps i18next's active
 * language synced with the user's `user_settings.language` preference.
 * Falls back to English on load (before settings have resolved) and on
 * any unsupported value.
 */
export function useLocalizedT() {
  const { settings } = useSettings();
  const { t, i18n } = useTranslation("sanctuary");

  useEffect(() => {
    const target = toI18nCode(settings?.language);
    if (i18n.language !== target) {
      i18n.changeLanguage(target);
    }
  }, [settings?.language, i18n]);

  return { t, i18n };
}
