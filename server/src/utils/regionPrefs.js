// server/src/utils/regionPrefs.js

/**
 * Given a userRegion like "nl" or "de",
 * return a list of preferred fallback regions in order.
 *
 * Example:
 *   "nl" -> ["nl", "eu", "de", "global"]
 *   "us" -> ["us", "global"]
 */
function buildRegionPreferenceChain(userRegion) {
  const region = (userRegion || "global").toLowerCase();

  switch (region) {
    case "nl":
    case "be":
      return ["nl", "be", "eu", "de", "global"];
    case "de":
      return ["de", "eu", "global"];
    case "uk":
    case "gb":
      return ["uk", "gb", "eu", "global"];
    case "us":
      return ["us", "global"];
    case "ca":
      return ["ca", "us", "global"];
    case "eu":
      return ["eu", "de", "uk", "gb", "global"];
    case "global":
      return ["global"];
    default:
      // Unknown region — include it first, then fall back broadly
      return [region, "global"];
  }
}

module.exports = { buildRegionPreferenceChain };
