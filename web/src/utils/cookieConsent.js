export const COOKIE_CONSENT_STORAGE_KEY = 'cookieConsent_v1';

export const defaultConsent = {
  essential: true,
  analytics: false,
  updatedAt: null,
};

export function loadConsent() {
  if (typeof window === 'undefined') return defaultConsent;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return defaultConsent;
    const parsed = JSON.parse(raw);
    return { ...defaultConsent, ...parsed, essential: true };
  } catch {
    return defaultConsent;
  }
}

export function saveConsent(consent) {
  const withMeta = {
    ...defaultConsent,
    ...consent,
    essential: true,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(withMeta));
      window.cookieConsent = withMeta;
    } catch {
      // ignore storage errors
    }
  }
  return withMeta;
}

export function hasStoredConsent() {
  if (typeof window === 'undefined') return false;
  try {
    return !!window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return false;
  }
}
