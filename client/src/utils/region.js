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

// Map messy labels to ISO alpha-2 we use everywhere
export function normalizeRegion(code) {
  const k = String(code || "")
    .trim()
    .toUpperCase();
  const map = {
    USA: "US",
    UNITED_STATES: "US",
    US: "US",
    CDN: "CA",
    CANADA: "CA",
    CA: "CA",
    UK: "GB",
    GB: "GB",
  };
  // For normalization we do NOT want to silently pick "GB" for unknown.
  // If it's not in the map and not already a 2-letter code, return empty string.
  const normalized = map[k] || (/^[A-Z]{2}$/.test(k) ? k : "");

  // Map to a supported region so affiliate resolution uses a known value
  return mapToSupportedRegion(normalized);
}

/**
 * Map any country code to the closest supported region.
 * Mirrors server-side mapToSupportedRegion in regionDetection.js
 */
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "NO", "CH", "IS",
]);
const UK_FALLBACK = new Set(["AU", "NZ", "SG", "HK", "ZA", "IN"]);
const US_FALLBACK = new Set(["MX", "BR", "AR", "CL", "CO", "PE", "VE", "EC", "PR"]);

function mapToSupportedRegion(code) {
  if (!code) return "";
  const cc = code.toUpperCase();

  if (["US", "CA", "DE", "NL"].includes(cc)) return cc;
  if (cc === "GB" || cc === "UK") return "GB";
  if (EU_COUNTRIES.has(cc)) return cc; // pass through — server maps to "eu"
  if (UK_FALLBACK.has(cc)) return "GB";
  if (US_FALLBACK.has(cc)) return "US";

  return cc; // let the server handle final mapping
}
