// client/src/utils/region.js
/**
 * Best-effort region detection:
 * 1) Explicit app setting if you have one (pass as arg)
 * 2) Browser locale region subtag (e.g., "en-GB" -> "GB")
 * 3) Language-to-locale hints
 * 4) Fallback "GB"
 */
export function detectRegion(preferredRegion) {
  if (preferredRegion && /^[A-Z]{2}$/.test(preferredRegion))
    return preferredRegion;

  // Try browser locale
  const loc = (
    Intl.DateTimeFormat().resolvedOptions().locale || ""
  ).toUpperCase();

  const m = loc.match(/-([A-Z]{2})/);
  if (m) return m[1];

  // Fall back by language (very rough defaults)
  const lang = (navigator.language || "en-GB").slice(0, 2).toLowerCase();
  const langMap = {
    en: "GB",
    de: "DE",
    nl: "NL",
    fr: "FR",
    es: "ES",
    it: "IT",
    sv: "SE",
    no: "NO",
    da: "DK",
    fi: "FI",
    pl: "PL",
    pt: "PT",
  };
  return langMap[lang] || "GB";
}

/**
 * Should the cookie-consent banner be shown?
 * EU timezones → yes; clear US/CA languages (non-EU timezone) → no; default → yes.
 */
export function isBannerRegion() {
  try {
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.startsWith("Europe/")) return true;
    }
    if (typeof navigator !== "undefined") {
      const lang = (navigator.language || "").toLowerCase();
      if (["en-us", "en-ca", "fr-ca"].some((p) => lang.startsWith(p))) {
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

// Normalise messy labels to a lowercase ISO alpha-2 country code.
// The server's buildRegionPreferenceChain handles affiliate routing from there.
export function normalizeRegion(code) {
  const k = String(code || "")
    .trim()
    .toUpperCase();
  const aliases = {
    USA: "US",
    UNITED_STATES: "US",
    CDN: "CA",
    CANADA: "CA",
    UK: "GB",
  };
  const resolved = aliases[k] || (/^[A-Z]{2}$/.test(k) ? k : "");
  return resolved.toLowerCase();
}
