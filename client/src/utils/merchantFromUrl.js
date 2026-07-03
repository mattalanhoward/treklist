// Map a per-variant buy-link URL to its merchant display name.
// Consolidated variants can point at different resellers than the item-level offer
// (e.g. a Cumulus quilt whose 150g fill came from GGG but 300/450g from Farlite), so
// the buy-button LABEL must follow the variant's link, not the item's merchant.
const MERCHANT_BY_HOST = {
  "garagegrowngear.com": "Garage Grown Gear",
  "farlite.fi": "Farlite",
  "exped.com": "Exped",
  "atompacks.co.uk": "Atom Packs",
  "minimalgear.com": "Minimal Gear",
  "opinel-usa.com": "Opinel",
};

export function merchantFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return MERCHANT_BY_HOST[host] || null;
  } catch {
    return null;
  }
}
