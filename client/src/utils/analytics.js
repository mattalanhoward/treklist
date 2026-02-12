// src/utils/analytics.js
import { loadConsent } from "./cookieConsent";

let analyticsInitialized = false;
let consentDefaultsSet = false;

const GTM_ID = import.meta.env.VITE_GTM_ID;

// Helper for gtag commands via dataLayer
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

// Set default consent state (must be called before GTM loads)
export function setConsentDefaults() {
  if (typeof window === "undefined") return;
  if (consentDefaultsSet) return;

  window.dataLayer = window.dataLayer || [];

  // Set default consent to denied - GTM will wait for update
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });

  consentDefaultsSet = true;
}

export function initAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (analyticsInitialized) return;
  if (!GTM_ID) return;

  const consent = loadConsent();

  // Only load GTM if user has granted analytics consent
  if (!consent.analytics) return;

  // Set consent defaults before loading GTM
  setConsentDefaults();

  // Prevent double-injection of GTM script
  if (document.querySelector(`script[data-treklist-gtm="true"]`)) {
    // GTM already loaded, just ensure consent is granted
    gtag("consent", "update", {
      analytics_storage: "granted",
    });
    analyticsInitialized = true;
    return;
  }

  // Push gtm.start event before loading the script (required by GTM)
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

  // Load GTM script
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  script.async = true;
  script.setAttribute("data-treklist-gtm", "true");
  document.head.appendChild(script);

  // Grant consent - this must come after defaults are set
  gtag("consent", "update", {
    analytics_storage: "granted",
  });

  analyticsInitialized = true;
}

// Called when user grants consent via cookie banner
export function grantAnalyticsConsent() {
  if (typeof window === "undefined") return;

  gtag("consent", "update", {
    analytics_storage: "granted",
  });
}

export function disableAnalytics() {
  if (typeof window === "undefined") return;

  // Revoke consent using proper Consent Mode v2 format
  gtag("consent", "update", {
    analytics_storage: "denied",
  });

  // Remove GTM script
  document
    .querySelectorAll(`script[data-treklist-gtm="true"]`)
    .forEach((el) => el.remove());

  // Clear GA cookies (best-effort)
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (
      name === "_ga" ||
      name === "_gid" ||
      name === "_gat" ||
      name.startsWith("_ga_")
    ) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    }
  });

  analyticsInitialized = false;
}
