//src/utils/regionDetection.js
const geoip = require("geoip-lite");

/**
 * Extract client IP from Express request
 * Handles proxies, load balancers, and direct connections
 */
function getClientIp(req) {
  // Check common proxy headers first
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list: "client, proxy1, proxy2"
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0]; // First IP is the original client
  }

  // Check other common headers
  const realIp = req.headers["x-real-ip"];
  if (realIp) return realIp;

  const cfConnectingIp = req.headers["cf-connecting-ip"]; // Cloudflare
  if (cfConnectingIp) return cfConnectingIp;

  // Fallback to socket address
  return req.socket?.remoteAddress || req.connection?.remoteAddress || null;
}

/**
 * Normalize IP address (strip IPv6 prefix from IPv4-mapped addresses)
 * Example: ::ffff:192.168.1.1 -> 192.168.1.1
 */
function normalizeIp(ip) {
  if (!ip) return null;

  // Strip IPv6 prefix from IPv4-mapped addresses
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  return ip;
}

/**
 * Detect region from IP address
 * @param {string} ip - IP address to check
 * @returns {string} - Two-letter country code (lowercase) or 'global'
 */
function detectRegionFromIp(ip) {
  if (!ip) return "global";

  // Handle localhost
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    return "global"; // or set a default region for development
  }

  const normalized = normalizeIp(ip);
  const geo = geoip.lookup(normalized);

  if (!geo || !geo.country) {
    return "global";
  }

  // Return lowercase country code
  return geo.country.toLowerCase();
}

/**
 * Detect viewer's country from Express request.
 * Returns the raw 2-letter country code (e.g. "au", "de") or "global".
 * Affiliate routing is handled downstream by buildRegionPreferenceChain.
 * @param {Object} req - Express request object
 * @returns {string} - Lowercase 2-letter country code or 'global'
 */
function detectViewerRegion(req) {
  const ip = getClientIp(req);
  return detectRegionFromIp(ip);
}

/**
 * Normalize region codes to match your database values
 * @param {string} region - Raw region/country code
 * @returns {string} - Normalized region code
 */
function normalizeRegion(region) {
  if (!region) return "global";

  const r = String(region).trim().toLowerCase();

  // Handle common variations
  if (r === "netherlands") return "nl";
  if (r === "united states" || r === "usa") return "us";
  if (r === "united kingdom" || r === "great britain" || r === "gb")
    return "uk";

  // Already a 2-letter code
  if (r.length === 2) return r;

  return r;
}

/**
 * Map any detected country code to the closest supported region.
 * Supported regions: us, ca, uk, de, nl, eu, global
 * Countries without a direct match are grouped by geographic/marketplace proximity.
 * @param {string} countryCode - Two-letter country code (lowercase)
 * @returns {string} - A supported region code
 */
function mapToSupportedRegion(countryCode) {
  if (!countryCode) return "global";

  const cc = String(countryCode).trim().toLowerCase();

  // Directly supported regions
  const direct = new Set(["us", "ca", "uk", "de", "nl"]);
  if (direct.has(cc)) return cc;
  if (cc === "gb") return "uk";

  // EU countries → "eu"
  const euCountries = new Set([
    "at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr",
    "gr", "hu", "ie", "it", "lv", "lt", "lu", "mt", "pl", "pt",
    "ro", "sk", "si", "es", "se", "no", "ch", "is",
  ]);
  if (euCountries.has(cc)) return "eu";

  // Commonwealth / English-speaking → "uk" (best Amazon marketplace match)
  const ukFallback = new Set(["au", "nz", "sg", "hk", "za", "in"]);
  if (ukFallback.has(cc)) return "uk";

  // Americas → "us"
  const usFallback = new Set([
    "mx", "br", "ar", "cl", "co", "pe", "ve", "ec", "pr",
  ]);
  if (usFallback.has(cc)) return "us";

  // East Asia → "global" (no supported marketplace yet)
  // Everything else → "global"
  return "global";
}

module.exports = {
  getClientIp,
  normalizeIp,
  detectRegionFromIp,
  detectViewerRegion,
  normalizeRegion,
  mapToSupportedRegion,
};
