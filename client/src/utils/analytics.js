// src/utils/analytics.js
import { loadConsent } from "./cookieConsent";

let analyticsInitialized = false;
let gtmScriptEl = null;

const GTM_ID = import.meta.env.VITE_GTM_ID;

export function initAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (analyticsInitialized) return;

  const consent = loadConsent();
  if (!consent.analytics) return;
  if (!GTM_ID) return;

  // Prevent double-injection
  if (document.querySelector(`script[data-treklist-gtm="true"]`)) {
    analyticsInitialized = true;
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "consent_granted",
    analytics_storage: "granted",
  });

  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  script.async = true;
  script.setAttribute("data-treklist-gtm", "true");

  document.head.appendChild(script);
  gtmScriptEl = script;
  analyticsInitialized = true;
}

export function disableAnalytics() {
  if (typeof window === "undefined") return;

  // Inform GTM / GA consent is revoked
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "consent_revoked",
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
