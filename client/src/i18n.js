// client/src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import nlCommon from "./locales/nl/common.json";

const resources = {
  en: {
    common: enCommon,
  },
  nl: {
    common: nlCommon,
  },
};

// Languages we actively support right now
const SUPPORTED_LANGS = ["en", "nl"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    load: "languageOnly", // en-US -> en
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS,
    ns: ["common"],
    defaultNS: "common",
    detection: {
      // Prefer an explicit stored choice, then browser, then <html lang>, then cookie
      order: ["localStorage", "navigator", "htmlTag", "cookie"],
      caches: ["localStorage"],
      // IMPORTANT: reuse your existing key instead of "i18nextLng"
      lookupLocalStorage: "language",
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

// Keep <html lang="..."> in sync with the active language
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng || "en";
  }
});

// Set initial lang ASAP on first load
if (typeof document !== "undefined") {
  const initialLang = i18n.resolvedLanguage || i18n.language || "en";
  document.documentElement.lang = initialLang;
}

export default i18n;
