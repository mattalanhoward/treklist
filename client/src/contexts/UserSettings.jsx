import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";
import useAuth from "../hooks/useAuth";
import i18n from "../i18n";
import { detectRegion, normalizeRegion } from "../utils/region";

const SettingsCtx = createContext();
const SUPPORTED_LANGS = ["en", "nl", "de", "fr", "it", "es"];
const SUPPORTED_REGIONS = ["nl", "us", "ca", "gb", "de", "fr", "it"];

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth();

  // ─── local state (init from localStorage for instant paint) ───
  const [weightUnit, setWeightUnit] = useState(
    () => localStorage.getItem("weightUnit") || "g"
  );
  const [measurementSystem, setMeasurementSystem] = useState(
    () => localStorage.getItem("measurementSystem") || "metric"
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const [language, setLanguage] = useState(() => {
    // Accept lang param from marketing site (treklist.co passes ?lang=nl etc.)
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
      localStorage.setItem("language", urlLang);
      i18n.changeLanguage(urlLang);
      return urlLang;
    }

    // Prefer an explicit stored choice
    const stored = localStorage.getItem("language");
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

    // Then whatever i18next detected (browser, etc.)
    const detected = i18n.resolvedLanguage || i18n.language;
    if (detected && SUPPORTED_LANGS.includes(detected)) return detected;

    // Fallback
    return "en";
  });
  const [region, setRegion] = useState(() => {
    // 1) Prefer explicit stored choice (normalize -> ISO -> lowercase)
    const stored = normalizeRegion(localStorage.getItem("region"));
    if (stored) {
      const lc = stored.toLowerCase();
      if (SUPPORTED_REGIONS.includes(lc)) return lc;
    }

    // 2) Auto-detect on first visit
    const detected = normalizeRegion(detectRegion());
    const detectedLc = detected ? detected.toLowerCase() : "";
    if (SUPPORTED_REGIONS.includes(detectedLc)) return detectedLc;

    // 3) Safe fallback (must be supported everywhere)
    return "gb";
  });
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("viewMode") || "column"
  );
  // Note: we still render instantly, then hydrate from /settings when logged in.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    // fallback to localStorage so unauth/first paint feels consistent
    (() => {
      const v = localStorage.getItem("sidebarCollapsed");
      return v === "true" ? true : false;
    })()
  );

  const [sidebarGearListsCollapsed, setSidebarGearListsCollapsed] = useState(
    () => localStorage.getItem("sidebarGearListsCollapsed") === "true"
  );

  const [sidebarMyGearCollapsed, setSidebarMyGearCollapsed] = useState(
    () => localStorage.getItem("sidebarMyGearCollapsed") === "true"
  );

  // Track if we've hydrated from the server to avoid echo PATCH
  const [hydrated, setHydrated] = useState(false);

  // Derived BCP-47 locale (always language-REGION)
  const locale = `${language}-${region.toUpperCase()}`;

  // ─── DOM side effects (theme) + mirror to localStorage ───
  useEffect(() => {
    localStorage.setItem("weightUnit", weightUnit);
  }, [weightUnit]);

  useEffect(() => {
    localStorage.setItem("measurementSystem", measurementSystem);
    // Auto-sync weight unit from measurement system
    setWeightUnit(measurementSystem === "imperial" ? "oz" : "g");
  }, [measurementSystem]);

  useEffect(() => {
    if (!language) return;

    // Normalize to a supported language
    const normalized = SUPPORTED_LANGS.includes(language) ? language : "en";

    // If we had an unsupported value (e.g. old "de"), fix it once
    if (normalized !== language) {
      setLanguage(normalized);
      return;
    }

    localStorage.setItem("language", normalized);

    // Keep i18next in sync
    if (i18n.language !== normalized) {
      i18n.changeLanguage(normalized);
    }
  }, [language]);

  useEffect(() => {
    const normalized = normalizeRegion(region);
    const lc = (normalized || "").toLowerCase();
    const safe = SUPPORTED_REGIONS.includes(lc) ? lc : "gb";

    if (safe !== region) {
      setRegion(safe);
      return;
    }
    localStorage.setItem("region", safe);
  }, [region]);

  useEffect(() => {
    localStorage.setItem("theme", theme);

    const root = document.documentElement;

    // remove any previous theme-* class (future-proof)
    [...root.classList].forEach((cls) => {
      if (cls.startsWith("theme-")) root.classList.remove(cls);
    });

    // apply current theme
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(!!sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      "sidebarGearListsCollapsed",
      String(!!sidebarGearListsCollapsed)
    );
  }, [sidebarGearListsCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      "sidebarMyGearCollapsed",
      String(!!sidebarMyGearCollapsed)
    );
  }, [sidebarMyGearCollapsed]);

  // ─── HYDRATE from server on mount/login ───
  const refreshSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get("/settings");
      const s = res.data || {};
      // Apply with sensible fallbacks + normalization
      setWeightUnit(s.weightUnit || "g");
      setMeasurementSystem(s.measurementSystem || "metric");
      setTheme(s.theme || "alpine");
      // localStorage wins: user may have picked a language on the landing page pre-login.
      // The PATCH useEffect will sync the resolved value back to the DB automatically.
      const localLang = localStorage.getItem("language");
      const dbLang = s.language || "en";
      const resolvedLang =
        localLang && SUPPORTED_LANGS.includes(localLang) ? localLang : dbLang;
      setLanguage(resolvedLang);
      setRegion((s.region || "nl").toLowerCase());
      setViewMode(s.viewMode || "column");
      setSidebarCollapsed(Boolean(s.sidebarCollapsed));
      setSidebarGearListsCollapsed(Boolean(s.sidebarGearListsCollapsed));
      setSidebarMyGearCollapsed(Boolean(s.sidebarMyGearCollapsed));
      setHydrated(true);
    } catch (err) {
      console.error("Failed to load settings:", err);
      setHydrated(true); // don’t block PATCHs forever
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  // ─── Persist to server whenever user changes a value ───
  useEffect(() => {
    if (!isAuthenticated || !hydrated) return; // ← prevent echo on initial hydrate
    const payload = {
      weightUnit,
      measurementSystem,
      theme,
      language,
      region: (region || "nl").toLowerCase(),
      viewMode,
      locale,
      sidebarCollapsed,
      sidebarGearListsCollapsed,
      sidebarMyGearCollapsed,
    };
    api.patch("/settings", payload).catch((err) => {
      console.error("Failed to save settings:", err);
    });
  }, [
    isAuthenticated,
    hydrated,
    weightUnit,
    measurementSystem,
    theme,
    language,
    region,
    viewMode,
    locale,
    sidebarCollapsed,
    sidebarGearListsCollapsed,
    sidebarMyGearCollapsed,
  ]);

  // Optional helpers for screens that PATCH explicitly:
  const applySettings = useCallback((partial) => {
    if (partial.weightUnit != null) setWeightUnit(partial.weightUnit);
    if (partial.measurementSystem != null)
      setMeasurementSystem(partial.measurementSystem);
    if (partial.theme != null) setTheme(partial.theme);
    if (partial.language != null) setLanguage(partial.language);
    if (partial.region != null) setRegion(String(partial.region).toLowerCase());
    if (partial.viewMode != null) setViewMode(partial.viewMode);
    if (partial.sidebarCollapsed != null)
      setSidebarCollapsed(Boolean(partial.sidebarCollapsed));
    if (partial.sidebarGearListsCollapsed != null)
      setSidebarGearListsCollapsed(Boolean(partial.sidebarGearListsCollapsed));
    if (partial.sidebarMyGearCollapsed != null)
      setSidebarMyGearCollapsed(Boolean(partial.sidebarMyGearCollapsed));
  }, []);

  return (
    <SettingsCtx.Provider
      value={{
        // values
        weightUnit,
        measurementSystem,
        theme,
        language,
        region,
        locale,
        viewMode,
        sidebarCollapsed,
        sidebarGearListsCollapsed,
        sidebarMyGearCollapsed,
        hydrated,
        // setters
        setWeightUnit,
        setMeasurementSystem,
        setTheme,
        setLanguage,
        setRegion,
        setViewMode,
        setSidebarCollapsed,
        setSidebarGearListsCollapsed,
        setSidebarMyGearCollapsed,
        // helpers
        refreshSettings,
        applySettings,
      }}
    >
      {children}
    </SettingsCtx.Provider>
  );
}

export const useUserSettings = () => {
  const ctx = useContext(SettingsCtx);
  if (!ctx) {
    throw new Error("useUserSettings must be used inside a SettingsProvider");
  }
  return ctx;
};
