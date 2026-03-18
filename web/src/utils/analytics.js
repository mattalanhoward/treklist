import { loadConsent } from './cookieConsent';

let analyticsInitialized = false;
let consentDefaultsSet = false;

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

export function setConsentDefaults() {
  if (typeof window === 'undefined') return;
  if (consentDefaultsSet) return;
  window.dataLayer = window.dataLayer || [];
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  consentDefaultsSet = true;
}

export function initAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (analyticsInitialized) return;
  if (!GTM_ID) return;
  const consent = loadConsent();
  if (!consent.analytics) return;
  setConsentDefaults();
  if (document.querySelector('script[data-treklist-gtm="true"]')) {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    analyticsInitialized = true;
    return;
  }
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  script.async = true;
  script.setAttribute('data-treklist-gtm', 'true');
  document.head.appendChild(script);
  gtag('consent', 'update', { analytics_storage: 'granted' });
  analyticsInitialized = true;
}

export function grantAnalyticsConsent() {
  if (typeof window === 'undefined') return;
  gtag('consent', 'update', { analytics_storage: 'granted' });
}

export function disableAnalytics() {
  if (typeof window === 'undefined') return;
  gtag('consent', 'update', { analytics_storage: 'denied' });
  document.querySelectorAll('script[data-treklist-gtm="true"]').forEach((el) => el.remove());
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name === '_ga' || name === '_gid' || name === '_gat' || name?.startsWith('_ga_')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    }
  });
  analyticsInitialized = false;
}
