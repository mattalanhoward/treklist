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
  [/pack liner|backpack liner|rucksack liner|pack\s*liner/i, "Pack Liner"],
  [/dry\s*bag|waterproof bag|stuff\s*sack|dry\s*sack|compression sack|packing cube|\bditty\b/i, "Dry Bag / Stuff Sack"],

  // --- packs (specific before generic) ---
  [/hip pack|waist pack|lumbar pack|bum bag|fanny pack/i, "Hip Pack"],
  [/day\s?pack|day bag/i, "Daypack"],
  [/back\s?pack|rucksack|hiking pack|trekking pack|mountaineering pack/i, "Backpack"],

  // --- sleep ---
  [/sleeping bag liner|bag liner/i, "Sleeping Bag Liner"],
  [/sleeping bag/i, "Sleeping Bag"],
  [/\bquilt\b/i, "Quilt"],
  [/self.?inflat|inflatable (mat|mattress|pad|sleeping)|air mattress|sleeping mat\b/i, "Inflatable Sleeping Pad"],
  [/foam (mat|pad)|closed.?cell/i, "Foam Sleeping Pad"],
  [/\bpillow\b(?!\s*case)/i, "Pillow"], // exclude "pillow case" (an accessory)

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
  // rigid drink flasks (titanium/hip/wine/funnel) -> Kitchen; soft/collapsible water
  // flasks fall through to Water Bottle (hydration).
  [/hip flask|wine flask|whisk(e)?y flask|spirit flask|funnel flask|flat flask|titanium.*flask/i, "Flask"],
  [/water bottle|\bflask\b/i, "Water Bottle"],

  // --- cooking ---
  [/\bfuel\b|gas cartridge|gas canister/i, "Stove Fuel"],
  [/alcohol stove|spirit (stove|burner)|meths stove/i, "Stove (Alcohol)"],
  [/wood[- ]?burning stove|wood stove|twig stove|hobo stove/i, "Stove (Wood)"],
  [/whisperlite|dragonfly|\bxgk\b|liquid fuel stove|multi-?fuel stove/i, "Stove (Liquid Fuel)"],
  [/stove/i, "Stove (Canister)"],
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
  [/soft\s?shell|wind\s?shell|windshirt|wind shirt|alpine start/i, "Softshell Jacket"],
  [/down jacket|insulated jacket|puffer|padded jacket|wadded jacket/i, "Insulated Jacket"],
  [/fleece/i, "Fleece Jacket"],

  // --- base layers / tops ---
  [/base ?layer (bottom|legging|tight)|thermal (bottom|legging|tight)|long underwear|long johns/i, "Base Layer Bottom"],
  [/base ?layer|thermal top|merino (top|t-?shirt|base)/i, "Base Layer Top"],

  // --- accessories / headwear ---
  [/\bbra\b/i, "Bra"],
  [/\bsock(s)?\b/i, "Hiking Socks"],
  [/neck gaiter|neck warmer|neck\s?band|neck tube|\bbuff\b|\bbandana\b/i, "Neck Gaiter"],
  [/beanie|head\s?band|\bcap\b|sun hat|bucket hat|balaclava|\bhat\b/i, "Hat/Headwear"],
  [/underwear|boxer|\bbrief(s)?\b|knicker/i, "Underwear"],
  [/mosquito (net|head)|head net/i, "Mosquito Head Net"],
  [/sunglass|sun glasses/i, "Sunglasses"],
  [/\bgaiter(s)?\b/i, "Gaiters"], // neck gaiters caught above; bare "gaiter" = leg/shoe gaiter

  // --- bottoms / shirts ---
  [/convertible (pant|trouser)|zip-?off/i, "Convertible Pants"],
  [/\bshort(s)?\b/i, "Hiking Shorts"],
  [/\btrouser(s)?\b|\bpant(s)?\b|\blegging(s)?\b|\bjogger(s)?\b/i, "Hiking Pants"],
  [/t-?shirt|\btee\b|hiking shirt|trekking shirt|polo shirt|sun hoody|sun hoodie/i, "Hiking Shirt"],
  [/glove|mitten|\bmitt(s)?\b/i, "Gloves (Insulated)"],

  // --- footwear ---
  [/trail running shoe|trail shoe|running shoe/i, "Trail Running Shoes"],
  [/sandal/i, "Sandals"],
  [/\bboot(s)?\b/i, "Hiking Boots"], // mid/high-cut
  [/hiking shoe|walking shoe|approach shoe|low.?cut/i, "Hiking Shoes"], // low-cut

  // --- climbing & mountaineering ---
  [/via[\s-]?ferrata/i, "Via Ferrata Set"],
  [/\bice ?axe\b|\bpiolet\b|ice tool/i, "Ice Axe"],
  [/\bcrampon(s)?\b/i, "Crampon"],
  [/climbing helmet|mountaineering helmet|climbing and mountaineering helmet/i, "Climbing Helmet"],
  [/climbing harness|mountaineering harness|climbing and mountaineering harness/i, "Climbing Harness"],

  // --- gear / misc ---
  [/air pump|\binflator\b|pump ?bag|schnozzel|pumpbag/i, "Air Pump"],
  [/\bbivy\b|\bbivvy\b|bivy ?sack|survival bag/i, "Bivy Sack"],
  [/down bootie|down sock|camp bootie|camp boot(?!s? )|camp slipper|down slipper|camp shoe/i, "Camp Shoes"],
  [/micro ?spike|traction device|ice cleat|\bcleats?\b/i, "Traction Device"],
  [/repeller|repellent|insect repellent|mosquito coil/i, "Insect Repellent"],
  [/\bhammock\b/i, "Hammock"],
  [/camp chair|camp stool|backpacking chair|\bstool\b/i, "Camp Chair"],
  [/\btrowel\b|deuce of spades|poop shovel|potty trowel/i, "Trowel"],
  [/sit pad|seat pad|sitting pad|foam seat/i, "Sit Pad"],
  [/hip.?belt pocket|hipbelt pocket|shoulder pouch|pole holster|bottle (sleeve|holster)|pack accessory/i, "Pack Accessory"],

  // --- misc gear ---
  [/bear canister|bear ?vault|food canister/i, "Bear Canister"],
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

// Accessories / spare parts whose names contain a main-product keyword but are
// NOT that product (e.g. "Windscreen For Trekking Stove", "Spare pole").
const ACCESSORY =
  /windscreen|wind ?shield|spare part|spare pole|replacement (part|spare|pole)|repair (kit|patch)/i;

/**
 * @param {string} name - product name (primary signal)
 * @param {string} [hint] - optional secondary text (merchantCategory/description)
 * @returns {string|null} a valid schema itemType, or null when not confident
 */
function inferItemType(name, hint = "") {
  const text = `${name || ""}`;
  if (ACCESSORY.test(text)) return null;
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

/**
 * Coerce a possibly free-form itemType (e.g. from an LLM) onto the schema enum.
 * Returns the value as-is if already valid; otherwise classifies from the
 * type string + product name; otherwise null. Guaranteed valid-or-null.
 * @param {string} value - candidate itemType (may be free-form)
 * @param {string} [name] - product name, for fallback classification
 * @returns {string|null}
 */
function normalizeItemType(value, name = "") {
  const v = typeof value === "string" ? value.trim() : "";
  if (v && isValidItemType(v)) return v;
  return inferItemType(`${v} ${name}`.trim());
}

// =============================================================================
// itemType -> controlled TAXONOMY (category + subcategory)
// =============================================================================
// The app's category/subcategory FILTERS are driven by the locked taxonomy in
// client/src/config/catalogTaxonomy.js, and the catalog API filters `category`
// EXACTLY. Feed product_type strings ("Backpacks / Frameless", "Sleeping Bags")
// are NOT that taxonomy, so items imported with raw feed categories are
// invisible to the filters. We therefore derive category/subcategory from the
// already-classified itemType instead.
//
// Values below are the ground-truth pairs the curated catalog already uses, so
// imported items land in the same buckets as hand-curated ones. Clothing and
// footwear are gender-resolved from the product name at call time.
// `gendered: true`  -> category becomes Men's/Women's/Unisex Clothing; the
//                      mapped subcategory only applies for Men's/Women's (their
//                      lists carry Base Layers/Shirts/etc.; Unisex does not).
// `footwear: true`  -> subcategory becomes "<Gender> Footwear".
// -----------------------------------------------------------------------------
const CATEGORY_BY_ITEM_TYPE = {
  // ---- Sleep System ----
  "Sleeping Bag": ["Sleep System", "Sleeping Bags"],
  Quilt: ["Sleep System", "Quilts"],
  "Sleeping Bag Liner": ["Sleep System", "Sleeping Bag Liners"],
  "Inflatable Sleeping Pad": ["Sleep System", "Sleeping Pads"],
  "Foam Sleeping Pad": ["Sleep System", "Sleeping Pads"],
  Pillow: ["Sleep System", "Pillows"],
  // ---- Backpacks & Bags ----
  Backpack: ["Backpacks & Bags", "Backpacking Packs"],
  Daypack: ["Backpacks & Bags", "Day Packs & Accessories"],
  "Hip Pack": ["Backpacks & Bags", "Day Packs & Accessories"],
  // ---- Shelter ----
  "Backpacking Tent": ["Shelter", "Tents"],
  "Tarp Shelter": ["Shelter", "Backpacking Tarps"],
  "Tent Stakes": ["Shelter", "Tent Stakes"],
  "Ground Sheet": ["Shelter", "Ground Sheet"],
  // ---- Kitchen & Cooking ----
  "Backpacking Pot": ["Kitchen & Cooking", "Cookware"],
  "Stove (Canister)": ["Kitchen & Cooking", "Stoves"],
  "Stove (Alcohol)": ["Kitchen & Cooking", "Stoves"],
  "Stove (Wood)": ["Kitchen & Cooking", "Stoves"],
  "Stove (Liquid Fuel)": ["Kitchen & Cooking", "Stoves"],
  "Coffee Mug": ["Kitchen & Cooking", "Coffee"],
  Flask: ["Kitchen & Cooking", "Flasks"],
  Utensil: ["Kitchen & Cooking", "Utensils"],
  "Stove Fuel": ["Kitchen & Cooking", "Fuel - Isobutane"],
  // ---- Hydration ----
  "Water Filter": ["Hydration", "Water Treatment"],
  "Water Bottle": ["Hydration", "Hydration Containers"],
  "Hydration Reservoir": ["Hydration", "Hydration Containers"],
  // ---- Electronics & Power ----
  Headlamp: ["Electronics & Power", "Headlamps"],
  "Torch Light": ["Electronics & Power", "Torch Lights"],
  "Camp Lantern": ["Electronics & Power", "Lighting"],
  "Power Bank": ["Electronics & Power", "Charging & Power Banks"],
  "Travel Charger": ["Electronics & Power", "Charging & Power Banks"],
  "Charging Cable": ["Electronics & Power", "Charging & Power Banks"],
  Earbuds: ["Electronics & Power", "Headphones & Earbuds"],
  Smartphone: ["Electronics & Power", "Phones & GPS"],
  Smartwatch: ["Electronics & Power", "Wearables & GPS"],
  // ---- Accessories & Tools ----
  "Trekking Poles": ["Accessories & Tools", "Trekking Poles"],
  "Ice Axe": ["Accessories & Tools", "Climbing Gear"],
  "Crampon": ["Accessories & Tools", "Climbing Gear"],
  "Climbing Helmet": ["Accessories & Tools", "Climbing Gear"],
  "Climbing Harness": ["Accessories & Tools", "Climbing Gear"],
  "Via Ferrata Set": ["Accessories & Tools", "Climbing Gear"],
  "Air Pump": ["Sleep System", "Sleeping Pad Accessories"],
  "Bivy Sack": ["Shelter", "Tents"],
  "Camp Shoes": ["Footwear", null, { footwear: true }],
  "Traction Device": ["Accessories & Tools", "Micro Spikes"],
  "Insect Repellent": ["Accessories & Tools", "Insect Protection"],
  "Hammock": ["Shelter", "Tents"],
  "Camp Chair": ["Accessories & Tools", "Tools"],
  "Trowel": ["Accessories & Tools", "Tools"],
  "Pack Accessory": ["Backpacks & Bags", "Day Packs & Accessories"],
  "Sit Pad": ["Sleep System", "Sleeping Pad Accessories"],
  "Dry Bag / Stuff Sack": ["Accessories & Tools", "Dry Bags"],
  "Pack Liner": ["Accessories & Tools", "Dry Bags"],
  "Bear Canister": ["Accessories & Tools", "Food Storage"],
  "Pocket Knife": ["Accessories & Tools", "Knives"],
  "Mosquito Head Net": ["Accessories & Tools", "Insect Protection"],
  Umbrella: ["Accessories & Tools", "Rain Gear"],
  // ---- Health & Hygiene ----
  Toiletry: ["Health & Hygiene", "Personal Care"],
  "First Aid Kit": ["Health & Hygiene", "First Aid"],
  Medication: ["Health & Hygiene", "First Aid"],
  "Blister Prevention": ["Health & Hygiene", "Foot Care"],
  // ---- Navigation & Travel ----
  Guidebook: ["Navigation & Planning", "Guidebooks & Maps"],
  "Travel Towel": ["Travel", "Towels"],
  Document: ["Travel", "Documents"],
  Permit: ["Travel", "Documents"],
  Wallet: ["Travel", "Wallet"],
  // ---- Footwear (gender-resolved subcategory) ----
  "Hiking Boots": ["Footwear", null, { footwear: true }],
  "Hiking Shoes": ["Footwear", null, { footwear: true }],
  "Trail Running Shoes": ["Footwear", null, { footwear: true }],
  Sandals: ["Footwear", null, { footwear: true }],
  // ---- Always-Unisex clothing ----
  "Hat/Headwear": ["Unisex Clothing", "Headwear"],
  "Rain Poncho": ["Unisex Clothing", "Rain Gear"],
  Sunglasses: ["Unisex Clothing", "Accessories"],
  "Gloves (Insulated)": ["Unisex Clothing", "Accessories"],
  Bra: ["Women's Clothing", "Underwear"],
  // ---- Gendered clothing (category from name; subcat for Men's/Women's) ----
  "Base Layer Top": [null, "Base Layers", { gendered: true }],
  "Base Layer Bottom": [null, "Base Layers", { gendered: true }],
  "Hiking Shirt": [null, "Shirts", { gendered: true }],
  "Hiking Pants": [null, "Pants", { gendered: true }],
  "Convertible Pants": [null, "Pants", { gendered: true }],
  "Hiking Shorts": [null, "Shorts", { gendered: true }],
  "Hiking Socks": [null, "Socks", { gendered: true }],
  Underwear: [null, "Underwear", { gendered: true }],
  "Insulated Jacket": [null, "Jackets", { gendered: true }],
  "Fleece Jacket": [null, "Jackets", { gendered: true }],
  "Rain Jacket": [null, "Rain Gear", { gendered: true }],
  "Rain Pants": [null, "Rain Gear", { gendered: true }],
  "Softshell Jacket": [null, "Jackets", { gendered: true }],
  Gaiters: [null, "Gaiters", { gendered: true }],
  "Neck Gaiter": [null, "Neck Gaiter", { gendered: true }],
  // "Other" intentionally absent -> leaves category/subcategory unset.
};

// apostrophe class [’'] covers both straight ' and curly ’ (curly broke gendered
// category detection for brands like Katabatic — see backfill-gender.js).
const WOMENS_RE = /\b(women[’']?s|woman[’']?s|female|ladies|ladies[’'])\b/i;
const MENS_RE = /\b(men[’']?s|man[’']?s|male)\b/i; // word-boundary avoids matching "women"

function genderClothingCategory(name) {
  const w = WOMENS_RE.test(name);
  const m = MENS_RE.test(name);
  if (w && !m) return "Women's Clothing";
  if (m && !w) return "Men's Clothing";
  return "Unisex Clothing";
}

function genderFootwearSub(name) {
  const w = WOMENS_RE.test(name);
  const m = MENS_RE.test(name);
  if (w && !m) return "Women's Footwear";
  if (m && !w) return "Men's Footwear";
  return "Unisex Footwear";
}

/**
 * Map a (valid) itemType + product name onto the controlled catalog taxonomy.
 * Returns { category, subcategory } using only locked taxonomy values, so the
 * item is reachable by the catalog filters. Returns {} when the itemType has no
 * mapping (e.g. "Other" or null) — leave the item uncategorized rather than
 * inventing an off-taxonomy bucket.
 * @param {string|null} itemType
 * @param {string} [name] - product name, for gender resolution
 * @returns {{category?: string, subcategory?: string}}
 */
function categoryForItemType(itemType, name = "") {
  if (!itemType) return {};
  const entry = CATEGORY_BY_ITEM_TYPE[itemType];
  if (!entry) return {};
  const [cat, sub, opts] = entry;
  if (opts && opts.footwear) {
    return { category: "Footwear", subcategory: genderFootwearSub(name) };
  }
  if (opts && opts.gendered) {
    // Unisex Clothing now carries the same garment subcategories as Men's/Women's
    // (see catalogTaxonomy.js), so attach the mapped subcategory for every gender.
    const category = genderClothingCategory(name);
    return { category, subcategory: sub || undefined };
  }
  return { category: cat || undefined, subcategory: sub || undefined };
}

module.exports = {
  inferItemType,
  normalizeItemType,
  categoryForItemType,
  CATEGORY_BY_ITEM_TYPE,
  RULES,
};
