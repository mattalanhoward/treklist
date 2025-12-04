import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  hasStoredConsent,
  loadConsent,
  saveConsent,
} from "../utils/cookieConsent";
import { initAnalytics } from "../utils/analytics";
import { useTranslation } from "react-i18next";

// Better heuristic:
// 1) If timezone is Europe/* → show banner (treat as EU-ish).
// 2) Else, fall back to language: hide for clear US/CA languages.
// 3) For everything else, show banner (safe-by-default).
function isBannerRegion() {
  try {
    // Prefer timezone: closer to "where you are" than language
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.startsWith("Europe/")) {
        return true; // show banner in Europe
      }
    }

    // Fallback: use language to hide obvious US/CA
    if (typeof navigator !== "undefined") {
      const lang = (navigator.language || "").toLowerCase();
      const noBannerPrefixes = ["en-us", "en-ca", "fr-ca"];

      // If we are clearly US/CA language and not Europe timezone, assume no banner.
      if (noBannerPrefixes.some((prefix) => lang.startsWith(prefix))) {
        return false;
      }
    }

    // Default: show banner (safer than hiding it)
    return true;
  } catch {
    // If anything goes wrong, default to showing the banner
    return true;
  }
}

export default function CookieBanner() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Never show banner on the dedicated Cookie Settings page
    if (location.pathname.startsWith("/legal/cookie-settings")) {
      setOpen(false);
      return;
    }

    // If this environment / user shouldn't see a banner at all (e.g. US/CA)
    if (!isBannerRegion()) {
      setOpen(false);
      return;
    }

    // If consent is already stored, don't show
    if (hasStoredConsent()) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [location.pathname]);

  if (!open) return null;

  const handleAcceptAll = () => {
    const current = loadConsent();
    const next = saveConsent({ ...current, analytics: true });
    // User just consented to analytics; load analytics if configured.
    initAnalytics();
    setOpen(false);
  };

  const handleOpenSettings = () => {
    setOpen(false);

    // Logged-in (TopBar mounted) case: open the Legal modal on Cookie settings tab
    if (typeof window !== "undefined" && window.openCookieSettings) {
      window.openCookieSettings();
      return;
    }

    // Public / logged-out case: go to the Cookie Settings page
    navigate("/legal/cookie-settings");
  };

  const handleOpenCookiePolicy = () => {
    setOpen(false);
    navigate("/legal/cookies");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-3">
      <div className="max-w-3xl w-full bg-base-100 border border-base-300 shadow-lg rounded-lg p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 text-xs sm:text-sm">
        <div className="flex-1">
          <p className="mb-1">
            {t("cookieBanner.text.prefix", { appName: t("app.name") })}{" "}
            <strong>{t("cookieBanner.text.essential")}</strong>{" "}
            {t("cookieBanner.text.middle")}{" "}
            <strong>{t("cookieBanner.text.analytics")}</strong>{" "}
            {t("cookieBanner.text.suffix")}
          </p>
          <button
            type="button"
            onClick={handleOpenCookiePolicy}
            className="underline text-secondary hover:text-primary"
          >
            {t("cookieBanner.buttons.readPolicy")}
          </button>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="px-2 py-1 rounded bg-white text-secondary hover:bg-secondary/20 border border-secondary-300"
          >
            {t("cookieBanner.buttons.settings")}
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80"
          >
            {t("cookieBanner.buttons.acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
