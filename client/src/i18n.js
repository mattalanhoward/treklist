// client/src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import nlCommon from "./locales/nl/common.json";
import deCommon from "./locales/de/common.json";
import frCommon from "./locales/fr/common.json";
import itCommon from "./locales/it/common.json";
import esCommon from "./locales/es/common.json";

const resources = {
  en: { common: enCommon },
  nl: { common: nlCommon },
  de: { common: deCommon },
  fr: { common: frCommon },
  it: { common: itCommon },
  es: { common: esCommon },
};

const SUPPORTED_LANGS = Object.keys(resources);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    load: "languageOnly",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS,
    nonExplicitSupportedLngs: true, // helps with fr-FR / en-US, etc.
    ns: ["common"],
    defaultNS: "common",
    detection: {
      order: ["localStorage", "navigator", "htmlTag", "cookie"],
      caches: ["localStorage"],
      lookupLocalStorage: "language",
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng || "en";
  }
});

if (typeof document !== "undefined") {
  const initialLang = i18n.resolvedLanguage || i18n.language || "en";
  document.documentElement.lang = initialLang;
}

export default i18n;
