import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import hinglish from "./locales/hinglish.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import kn from "./locales/kn.json";
import ja from "./locales/ja.json";
import type { SupportedLanguage } from "@/lib/locale";

// Maps the project-wide SupportedLanguage strings ("hinglish", "tamil", ...)
// to the i18next locale codes we register below. Hinglish is intentionally
// a first-class locale (not a Hindi fallback) so we can author code-mixed
// copy with its own register.
const LANGUAGE_TO_I18N: Record<SupportedLanguage, string> = {
  english: "en",
  hindi: "hi",
  hinglish: "hinglish",
  japanese: "ja",
  telugu: "te",
  kannada: "kn",
  tamil: "ta",
};

export function toI18nCode(lang?: string | null): string {
  if (!lang) return "en";
  return LANGUAGE_TO_I18N[lang as SupportedLanguage] ?? "en";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { sanctuary: en },
      hi: { sanctuary: hi },
      hinglish: { sanctuary: hinglish },
      ta: { sanctuary: ta },
      te: { sanctuary: te },
      kn: { sanctuary: kn },
      ja: { sanctuary: ja },
    },
    fallbackLng: "en",
    defaultNS: "sanctuary",
    ns: ["sanctuary"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    // Surface authoring gaps in dev — Hinglish/Hindi keys are added over
    // time and silently missing translations would burn user trust.
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing key "${ns}:${key}" for ${lngs.join(",")}`);
      }
    },
  });

export default i18n;
