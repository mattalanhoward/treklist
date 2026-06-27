// server/src/config/inferItemType.js
// =============================================================================
// Deterministic, name-based itemType classifier mapping a product name onto the
// attributeSchemas.js taxonomy. Used so feed imports (e.g. Decathlon/Awin) land
// on a real itemType instead of null/"Other".
//
// Decathlon's merchant_category is marketing buckets ("Fishing", "Travel
// Accessories", "Black Friday"), NOT a taxonomy — so the NAME is the signal.
// Rules are ordered specific→generic; first match wins. CONSERVATIVE by design:
// return null when not confident (better uncategorized than miscategorized).
//
// Every returned value is guaranteed to be a valid schema itemType.
// =============================================================================

const { isValidItemType } = require("./attributeSchemas");

// [regex, itemType] — ORDER MATTERS (specific before generic).
const RULES = [
  // --- storage / sacks ---
  [/dry\s*bag|waterproof bag|stuff\s*sack|dry\s*sack|compression sack/i, "Dry Bag / Stuff Sack"],

  // --- sleep ---
  [/sleeping bag liner|bag liner/i, "Sleeping Bag Liner"],
  [/sleeping bag/i, "Sleeping Bag"],
  [/\bquilt\b/i, "Quilt"],
  [/self.?inflat|inflatable (mat|mattress|pad|sleeping)|air mattress|sleeping mat\b/i, "Inflatable Sleeping Pad"],
  [/foam (mat|pad)|closed.?cell/i, "Foam Sleeping Pad"],
  [/\bpillow\b/i, "Pillow"],

  // --- shelter ---
  [/footprint|ground ?sheet/i, "Ground Sheet"],
  [/tent (stake|peg)|tent pegs|guy ?line/i, "Tent Stakes"],
  [/\btarp\b/i, "Tarp Shelter"],
  [/\btent\b/i, "Backpacking Tent"],

  // --- poles ---
  [/trekking pole|hiking pole|walking pole/i, "Trekking Poles"],

  // --- lighting ---
  [/head\s?lamp|head\s?torch/i, "Headlamp"],
  [/lantern/i, "Camp Lantern"],
  [/flashlight|\btorch\b/i, "Torch Light"],

  // --- water ---
  [/water filter|water purif|filtration|purification/i, "Water Filter"],
  [/water treatment|purification tablet|treatment drops|chlorine dioxide/i, "Water Filter"],
  [/hydration|reservoir|water bladder/i, "Hydration Reservoir"],
  [/water bottle|\bflask\b/i, "Water Bottle"],

  // --- cooking ---
  [/\bfuel\b|gas cartridge|gas canister/i, "Stove Fuel"],
  [/stove/i, "Backpacking Stove (Canister)"],
  [/cook\s?set|cookware|\bpot\b|\bpan\b/i, "Backpacking Pot"],
  [/\bmug\b/i, "Coffee Mug"],
  [/spork|cutlery|utensil|\bspoon\b|\bfork\b/i, "Utensil"],

  // --- electronics ---
  [/power\s?bank|battery pack/i, "Power Bank"],
  [/\bcable\b/i, "Charging Cable"],
  [/wall charger|travel charger|travel adapter|plug adapter|adaptor|\bcharger\b/i, "Travel Charger"],
  [/ear\s?bud|ear\s?phone|airpod/i, "Earbuds"],
  [/smart\s?watch|gps watch/i, "Smartwatch"],

  // --- outerwear ---
  [/rain (trouser|pant)|waterproof (trouser|pant)|over\s?trouser/i, "Rain Pants"],
  [/rain jacket|waterproof jacket|hard\s?shell/i, "Rain Jacket"],
  [/poncho/i, "Rain Poncho"],
  [/umbrella/i, "Umbrella"],
  [/down jacket|insulated jacket|puffer|padded jacket|wadded jacket/i, "Insulated Jacket"],
  [/fleece/i, "Fleece Jacket"],

  // --- base layers / tops ---
  [/base ?layer (bottom|legging|tight)|thermal (bottom|legging|tight)|long underwear|long johns/i, "Base Layer Bottom"],
  [/base ?layer|thermal top|merino (top|t-?shirt|base)/i, "Base Layer Top"],

  // --- accessories / headwear ---
  [/\bbra\b/i, "Bra"],
  [/\bsock(s)?\b/i, "Hiking Socks"],
  [/beanie|\bbuff\b|neck gaiter|neck warmer|bandana|head\s?band|neck\s?band|\bcap\b|sun hat|bucket hat|\bhat\b/i, "Hat/Headwear"],
  [/underwear|boxer|\bbrief(s)?\b|knicker/i, "Underwear"],
  [/mosquito (net|head)|head net/i, "Mosquito Head Net"],
  [/sunglass|sun glasses/i, "Sunglasses"],
  [/\bgaiter\b/i, "Hat/Headwear"], // neck gaiter already caught above; bare "gaiter" fallback

  // --- bottoms / shirts ---
  [/convertible (pant|trouser)|zip-?off/i, "Convertible Pants"],
  [/\bshort(s)?\b/i, "Hiking Shorts"],
  [/\btrouser(s)?\b|\bpant(s)?\b|\blegging(s)?\b/i, "Hiking Pants"],
  [/t-?shirt|\btee\b|hiking shirt|trekking shirt|polo shirt/i, "Hiking Shirt"],
  [/glove|mitten/i, "Gloves (Insulated)"],

  // --- footwear ---
  [/trail running shoe|trail shoe|running shoe/i, "Trail Running Shoes"],
  [/sandal/i, "Sandals"],
  [/\bboot(s)?\b|hiking shoe|walking shoe/i, "Hiking Boots"],

  // --- misc gear ---
  [/bear canister|bear vault|food canister/i, "Bear Canister"],
  [/multi-?tool|pocket knife|\bknife\b/i, "Pocket Knife"],
  [/first aid/i, "First Aid Kit"],
  [/\btowel\b/i, "Travel Towel"],
  [/blister|leukotape|moleskin/i, "Blister Prevention"],
  [/guide ?book|trail guide/i, "Guidebook"],
];

// Non-hiking sport/activity contexts that share keywords with our taxonomy
// (football "shorts/socks", "swimming cap", "cricket quilt grip", "golf glove").
// If the name reads as one of these AND has no hiking/outdoor context, bail.
const NON_DOMAIN =
  /\b(football|soccer|basketball|cricket|golf|tennis|padel|squash|water ?polo|rugby|volleyball|netball|boxing|baseball|hockey|swim|swimming|swimsuit|swimwear|leotard|ballet|dance|gym|yoga|cycling jersey|bowling)\b/i;
const HIKING_CONTEXT =
  /\bhik|trek|backpack|camp|mountain|outdoor|bivou|alpin|climb|forclaz|quechua|simond|trail/i;

/**
 * @param {string} name - product name (primary signal)
 * @param {string} [hint] - optional secondary text (merchantCategory/description)
 * @returns {string|null} a valid schema itemType, or null when not confident
 */
function inferItemType(name, hint = "") {
  const text = `${name || ""}`;
  if (NON_DOMAIN.test(text) && !HIKING_CONTEXT.test(text)) return null;
  for (const [re, type] of RULES) {
    if (re.test(text)) return isValidItemType(type) ? type : null;
  }
  // weak secondary pass on the hint for a few unambiguous categories
  const h = `${hint || ""}`;
  if (/sleeping bag/i.test(h)) return "Sleeping Bag";
  if (/\btent\b/i.test(h)) return "Backpacking Tent";
  return null;
}

module.exports = { inferItemType, RULES };
