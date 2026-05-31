// server/src/utils/regionPrefs.js
//
// Maps a user's stored country code to an ordered list of affiliate offer
// regions to try. The resolver queries MerchantOffers using this chain and
// takes the first match.
//
// Active affiliate programs:
//   us  → Amazon US
//   ca  → Amazon CA
//   gb/uk → Amazon UK + Decathlon UK (OneLink handles EU/AU/NZ redirects)
//
// EU/Commonwealth users fall through to gb since OneLink redirects them to
// their local Amazon store and Decathlon ships broadly across Europe.

function buildRegionPreferenceChain(countryCode) {
  const cc = (countryCode || "us").toLowerCase().trim();

  switch (cc) {
    // ── Exact affiliate program matches ──────────────────────────────────
    case "us":
      return ["us", "global"];
    case "ca":
      return ["ca", "us", "global"];
    case "gb":
    case "uk":
      return ["gb", "uk", "eu", "global"];

    // ── Netherlands / Belgium ────────────────────────────────────────────
    case "nl":
    case "be":
      return ["nl", "be", "eu", "de", "gb", "uk", "global"];

    // ── DACH ─────────────────────────────────────────────────────────────
    case "de":
    case "at":
    case "ch":
      return ["de", "eu", "gb", "uk", "global"];

    // ── France ───────────────────────────────────────────────────────────
    case "fr":
      return ["fr", "eu", "gb", "uk", "global"];

    // ── Italy ────────────────────────────────────────────────────────────
    case "it":
      return ["it", "eu", "gb", "uk", "global"];

    // ── Spain + Portugal ─────────────────────────────────────────────────
    case "es":
    case "pt":
      return ["es", "eu", "gb", "uk", "global"];

    // ── Nordics ──────────────────────────────────────────────────────────
    case "se":
    case "no":
    case "dk":
    case "fi":
    case "is":
      return ["eu", "gb", "uk", "global"];

    // ── Other EU / EEA ───────────────────────────────────────────────────
    case "ie":
    case "pl":
    case "cz":
    case "sk":
    case "hu":
    case "ro":
    case "bg":
    case "hr":
    case "gr":
    case "lt":
    case "lv":
    case "ee":
    case "mt":
    case "cy":
    case "lu":
    case "si":
      return ["eu", "gb", "uk", "global"];

    // ── English-speaking Commonwealth → UK (OneLink → local Amazon) ──────
    case "au":
    case "nz":
    case "za":
    case "sg":
    case "hk":
    case "in":
      return ["gb", "uk", "eu", "global"];

    // ── Ireland ──────────────────────────────────────────────────────────
    // (already in EU block above, kept explicit for clarity)

    // ── Americas ─────────────────────────────────────────────────────────
    case "mx":
    case "br":
    case "ar":
    case "cl":
    case "co":
    case "pe":
    case "ve":
    case "ec":
    case "pr":
      return ["us", "global"];

    // ── No program / unknown ─────────────────────────────────────────────
    case "global":
      return ["us", "global"];

    // ── East Asia / Rest of World ─────────────────────────────────────────
    // No affiliate deals — best effort: try US then global
    default:
      return [cc, "us", "global"];
  }
}

module.exports = { buildRegionPreferenceChain };
