/**
 * create-bonfus.js — Bonfus (bonfus.com), WooCommerce Store API (open, no auth).
 * Targeted create (NOT the generic ingest importer): Bonfus's Store API `weight`
 * field is empty on every product (confirmed across the whole feed) — real specs
 * live in a "Specifications"/"Weights" section rendered into each live product
 * page's static HTML (WPBakery accordion or plain text, format varies by product),
 * hand-read per item below.
 *
 * Scope decisions (2026-07-08):
 * - "Altus - Custom Pack" dropped — build-to-order, no fixed spec.
 * - "Fabric" attribute on packs/shelters is COLOR (Black/White or Spruce Green/
 *   White) dressed up as a fabric name — dropped per the locked variant standard
 *   (color never a variant). Default source SKU picked per item (Black for packs,
 *   Spruce Green for Middus/Solus/Duos).
 * - Real per-size variant weights only exist for Aerus 55L (S/M/L genuinely differ
 *   by ±10g). Every other multi-size pack (Maxus/Framus 58/Framus 48/Saccus/Duos 2P)
 *   only publishes ONE weight for the whole line — applied flat across all Pack
 *   Size / Hip Belt Size / Floor Fabric values (same fallback used for Hilltop
 *   Packs' torso-sized packs). ⚠ Per user instruction (2026-07-08): whenever a flat
 *   weight is applied across a real variant axis like this, the item's DESCRIPTION
 *   must say so explicitly — never let a single number look like it was verified
 *   per-variant when it wasn't. Appended as a "\n\n* ..." trailing line, reusing
 *   the exact Atom Packs wording ("Listed weights are based on a Medium torso
 *   size; your configuration may vary.") wherever it's literally true (Framus
 *   58L/48L — Bonfus's own spec explicitly labels the number "(Medium)"); a
 *   situation-specific variant of that line elsewhere, where the axis isn't size/
 *   torso (Maxus = hip belt size, Duos 2P = floor fabric) or the source doesn't
 *   even state which size the number reflects (Saccus 48L). Apply this same rule
 *   — and reuse the Atom wording specifically whenever it's actually true — to
 *   every future brand import with the same flat-across-axis pattern.
 * - Middus/Solus/Duos are floorless pyramid shelters (mid-style); typed Backpacking
 *   Tent to match the Six Moon Designs Lunar Solo precedent (also floorless-by-
 *   default with an optional inner sold separately). DCF Square Flat Tarp is a true
 *   flat tarp -> Tarp Shelter. The 4 "Middus Innernet" mesh/solid inner-tent
 *   add-ons are real standalone products (their own price, weight, page) but have
 *   no matching itemType schema -> Other.
 * - 2 stake products (Titanium Shepherd Hook / Aluminum) kept SEPARATE, not merged
 *   into one Material-variant item — they're different lengths/profiles (165mm
 *   shepherd-hook vs 150mm), not just a fabric swap of the same design.
 *   weightGrams = the "Pack of 4" purchasable unit (per-stake weight x4).
 * - Excluded as noise: Gatekeeper Strap Set, Removable Webbing Belt, Removable
 *   Padded Hip Belt (hip-belt spare parts/replacements), UL Carbon Fiber Tent Poles
 *   (3 lengths) + pole extender (a-la-carte pole segments, no fixed product), Guyline
 *   2.5mm UHMWPE (cordage), "Add-on" (a €0.99 checkout line item, not a product).
 * - The "0.51" stuff sack line (lighter DCF than the kept "1.0" line) has bare
 *   product pages with no published weight anywhere on the site -> imported with
 *   weightGrams left null per the project's no-weight policy (don't fabricate).
 *
 *   node src/scripts/create-bonfus.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const BASE = "https://bonfus.com/wp-json/wc/store/v1/products";

const CATEGORY_BY_TYPE = {
  Backpack: ["Backpacks & Bags", "Backpacking Packs"],
  "Backpacking Tent": ["Shelter", "Tents"],
  "Tarp Shelter": ["Shelter", "Backpacking Tarps"],
  "Tent Stakes": ["Shelter", "Tent Stakes"],
  "Dry Bag / Stuff Sack": ["Accessories & Tools", "Dry Bags"],
  "Hip Pack": ["Backpacks & Bags", "Day Packs & Accessories"],
};

async function fetchProduct(id, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/${id}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) return res.json();
    } catch (e) {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`failed to fetch product ${id}`);
}

// ---------------------------------------------------------------------------
// PACKS
// ---------------------------------------------------------------------------
const PACKS = [
  {
    name: "Aerus 55L",
    description: "A 55L ultralight pack (47L internal + 8L external pockets) with an adjustable curved aluminum frame and tensioned mesh back panel for ventilation.",
    base: { gender: "Unisex", volumeLiters: 55, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: false, loadCapacityKg: 15 },
    axisName: "Pack Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", g: 785, sourceId: 18567 },
      { key: "Medium", g: 795, sourceId: 18568 },
      { key: "Large", g: 805, sourceId: 18569 },
    ],
  },
  {
    name: "Maxus 80L",
    description: "An 80L expedition pack built for long, remote journeys with heavy and bulky gear — advanced hip belt system, ample external attachment points.\n\n* Listed weight is not broken down by hip belt size; your configuration may vary.",
    base: { gender: "Unisex", volumeLiters: 80, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true, loadCapacityKg: 23 },
    axisName: "Hip Belt Size",
    defaultKey: "Standard",
    variants: [
      { key: "Standard", g: 1080, sourceId: 17575 },
      { key: "Large", g: 1080, sourceId: 17576 },
    ],
  },
  {
    name: "Fastus 23L",
    description: "A 23L fastpacking vest-pack with vest-style straps, five pockets and soft-flask security — sized for overnight trips without bounce during a run.",
    base: { gender: "Unisex", volumeLiters: 23, frameType: "Frameless", hipBeltType: "None" },
    weightGrams: 360,
    sourceId: 16563,
  },
  {
    name: "Framus 58L",
    description: "A 58L pack (50L internal + 8L external) built for multi-day missions with heavier loads — removable frame and back foam pad convert it to a frameless pack.\n\n* Listed weights are based on a Medium torso size; your configuration may vary.",
    base: { gender: "Unisex", volumeLiters: 58, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true, loadCapacityKg: 18 },
    axisName: "Pack Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", g: 795, sourceId: 12926 },
      { key: "Medium", g: 795, sourceId: 10874 },
      { key: "Large", g: 795, sourceId: 12924 },
    ],
  },
  {
    name: "Framus 48L",
    description: "A 48L pack (40L internal + 8L external) — the most versatile Framus size, frame and back foam pad removable to shed weight.\n\n* Listed weights are based on a Medium torso size; your configuration may vary.",
    base: { gender: "Unisex", volumeLiters: 48, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true, loadCapacityKg: 18 },
    axisName: "Pack Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", g: 760, sourceId: 12950 },
      { key: "Medium", g: 760, sourceId: 10474 },
      { key: "Large", g: 760, sourceId: 12949 },
    ],
  },
  {
    name: "Saccus 48L",
    description: "A 48L frameless pack with padded sewn-in hip belts, balancing volume, weight and comfort.\n\n* Bonfus does not publish a per-size weight breakdown; your configuration may vary.",
    base: { gender: "Unisex", volumeLiters: 48, frameType: "Frameless", hipBeltType: "Padded", hipBeltRemovable: false, loadCapacityKg: 10.5 },
    axisName: "Pack Size",
    defaultKey: "Medium",
    variants: [
      { key: "Medium", g: 480, sourceId: 12919 },
      { key: "Large", g: 480, sourceId: 12920 },
    ],
  },
  {
    name: "Iterus 38L",
    description: "A 38L frameless pack for the lightweight backpacker — low base pack weight, includes a removable 1\" webbing hip belt; a padded hip belt is available as an add-on.",
    base: { gender: "Unisex", volumeLiters: 38, frameType: "Frameless", hipBeltType: "Webbing Only", hipBeltRemovable: true, loadCapacityKg: 8.5 },
    weightGrams: 380,
    sourceId: 12922,
  },
];

// ---------------------------------------------------------------------------
// SHELTERS
// ---------------------------------------------------------------------------
const SHELTERS = [
  {
    name: "Middus 1P",
    itemType: "Backpacking Tent",
    description: "A 1-person floorless DCF pyramid shelter with 15 guyout points — trekking-pole pitched. An Innernet (mesh or solid) is sold separately for a full floor + bug net.",
    base: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", flyMaterial: "0.75 Dyneema Composite Fabric (DCF)" },
    weightGrams: 307,
    sourceId: 11258,
  },
  {
    name: "Middus 2P",
    itemType: "Backpacking Tent",
    description: "A 2-person floorless DCF pyramid shelter, the larger sibling of the Middus 1P. An Innernet (mesh or solid) is sold separately for a full floor + bug net.",
    base: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", flyMaterial: "0.75 Dyneema Composite Fabric (DCF)" },
    weightGrams: 457,
    sourceId: 9071,
  },
  {
    name: "Solus 1P",
    itemType: "Backpacking Tent",
    description: "An ultra-light 1-person 3-season DCF pyramid shelter designed for Nordic conditions, with multiple anchoring points and a low-to-the-ground pitch.",
    base: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", flyMaterial: "0.75/0.8 Dyneema Composite Fabric (DCF)" },
    weightGrams: 509,
    sourceId: 9947,
  },
  {
    name: "Duos 2P",
    itemType: "Backpacking Tent",
    description: "Bonfus's most versatile, best-selling 2-person 3-season DCF pyramid shelter. Floor fabric choice of abrasion-resistant Silpoly or DCF.\n\n* Listed weight is not broken down by floor fabric; your configuration may vary.",
    base: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", flyMaterial: "0.75 Dyneema Composite Fabric (DCF)" },
    axisName: "Floor Fabric",
    defaultKey: "Sil/PU",
    variants: [
      { key: "Sil/PU", g: 688, sourceId: 8306, attrs: { floorMaterial: "20D Sil/PU" } },
      { key: "DCF", g: 688, sourceId: 16597, attrs: { floorMaterial: "0.96 Dyneema Composite Fabric" } },
    ],
  },
  {
    name: "DCF Square Flat Tarp",
    itemType: "Tarp Shelter",
    description: "A superlight 266x266cm square flat tarp in Dyneema Composite Fabric — pitches in unlimited configurations from a roomy A-frame to wind-shedding setups.",
    base: { shape: "Rectangular", lengthCm: 266, widthCm: 266, material: "0.75 Dyneema Composite Fabric (DCF)", tieoutsIncluded: true, stakesIncluded: false },
    weightGrams: 278,
    sourceId: 8186,
  },
];

// ---------------------------------------------------------------------------
// INNERNETS (no matching itemType schema -> Other)
// ---------------------------------------------------------------------------
const INNERNETS = [
  { name: "Middus Innernet 1P (Mesh)", itemType: "Other", weightGrams: 235, sourceId: 11302,
    description: "Full mosquito mesh inner for the Middus 1P/2P pyramid shelter — one zippered entrance, 0.96 DCF floor, sized to fit taller users." },
  { name: "Middus Innernet 1P (Solid)", itemType: "Other", weightGrams: 274, sourceId: 19074,
    description: "Windproof ripstop lower + mosquito mesh upper inner for the Middus 1P/2P pyramid shelter — better wind/condensation protection in cooler conditions than the full-mesh version, 0.96 DCF floor." },
  { name: "Middus Innernet 2P (Mesh)", itemType: "Other", weightGrams: 335, sourceId: 9309,
    description: "Full mosquito mesh inner for the Middus 2P pyramid shelter — double-sided entry, 0.96 DCF floor, sized to fit taller users." },
  { name: "Middus Innernet 2P (Solid)", itemType: "Other", weightGrams: 374, sourceId: 19073,
    description: "Windproof ripstop lower + mosquito mesh upper inner for the Middus 2P pyramid shelter — double-sided entry, 0.96 DCF floor." },
];

// ---------------------------------------------------------------------------
// TENT / SHELTER ACCESSORIES
// ---------------------------------------------------------------------------
const TENT_ACCESSORIES = [
  {
    name: "Titanium Shepherd Hook Stakes",
    itemType: "Tent Stakes",
    description: "Strong, ultralight titanium shepherd-hook tent stakes, best suited for hard/firm ground. Sold in packs of 4.",
    base: { soldAs: "Pack of 4", stakeMaterial: "Titanium", stakeProfile: "Shepherd Hook", stakeLengthCm: 16.5 },
    weightGrams: 32,
    sourceId: 3237,
  },
  {
    name: "Aluminum Tent Stakes",
    itemType: "Tent Stakes",
    description: "7075-grade aluminum alloy tent stakes for medium-soft to medium-hard ground. Sold in packs of 4.",
    base: { soldAs: "Pack of 4", stakeMaterial: "Aluminum", stakeLengthCm: 15 },
    weightGrams: 34,
    sourceId: 3234,
  },
  {
    name: "DCF Tent Stakes Sack",
    itemType: "Dry Bag / Stuff Sack",
    description: "A small DCF stuff sack for tent stakes, closing with a mini cordlock and 1.2mm drawcord.",
    base: { volumeLiters: 0.8, material: "Dyneema Composite Fabric", closureType: "Drawcord" },
    weightGrams: 4,
    sourceId: 3238,
  },
];

// ---------------------------------------------------------------------------
// BAGS / POUCHES
// ---------------------------------------------------------------------------
const BAGS = [
  {
    name: "DCF Dry Bags",
    itemType: "Dry Bag / Stuff Sack",
    description: "Waterproof, ultralight dry bags in 0.96 Dyneema Composite Fabric, taped seams. Rated for normal backpacking conditions (not submersion).",
    base: { material: "0.96 Dyneema Composite Fabric", waterproof: true, seamSealed: true },
    axisName: "Size",
    defaultKey: "Medium",
    // individual size pages have no photos of their own -> use the grouped listing's images for all sizes.
    imagesSourceId: 3353,
    variants: [
      { key: "Small", g: 15, sourceId: 3349, attrs: { volumeLiters: 1 } },
      { key: "Medium", g: 19, sourceId: 3350, attrs: { volumeLiters: 4 } },
      { key: "Medium/Large", g: 27, sourceId: 3352, attrs: { volumeLiters: 8 } },
      { key: "Large", g: 29, sourceId: 3351, attrs: { volumeLiters: 10 } },
    ],
  },
  {
    name: "DCF Stuff Sacks",
    itemType: "Dry Bag / Stuff Sack",
    description: "General-purpose Dyneema Composite Fabric stuff sacks (1.0oz DCF).",
    base: { material: "1.0oz Dyneema Composite Fabric", closureType: "Drawcord" },
    axisName: "Size",
    defaultKey: "Medium",
    imagesSourceId: 3344,
    variants: [
      { key: "Small", g: 5, sourceId: 3345, attrs: { volumeLiters: 1 } },
      { key: "Medium", g: 8, sourceId: 3346, attrs: { volumeLiters: 4 } },
      { key: "Medium/Large", g: 13, sourceId: 3348, attrs: { volumeLiters: 8 } },
      { key: "Large", g: 14, sourceId: 3347, attrs: { volumeLiters: 10 } },
    ],
  },
  // NOTE: skipped "DCF 0.51 Stuff Sacks" (lighter-fabric line) — its 4 size pages
  // (3339/3340/3342/3341) have NO weight AND NO images published anywhere on the
  // site (bare stub pages, no grouped spec page like the 1.0 line has). Not enough
  // real data to catalog honestly; revisit if Bonfus ever publishes specs for it.
  {
    name: "DCF Ditty Bag",
    itemType: "Dry Bag / Stuff Sack",
    description: "A small 0.96 DCF ditty bag for organizing smaller items like chargers, power banks or headlamps.",
    base: { volumeLiters: 0.5, material: "0.96 Dyneema Composite Fabric" },
    weightGrams: 5,
    sourceId: 3354,
  },
  {
    name: "DCF Food Bag",
    itemType: "Dry Bag / Stuff Sack",
    description: "A waterproof 1.6 DCF food bag, taped seams — Medium holds 3-4 days of food, Large holds 5-7 days.",
    base: { material: "1.6 Dyneema Composite Fabric", waterproof: true, seamSealed: true },
    axisName: "Size",
    defaultKey: "Medium",
    variants: [
      { key: "Medium", g: 25, sourceId: 8340, attrs: { volumeLiters: 12.6 } },
      { key: "Large", g: 35, sourceId: 8341, attrs: { volumeLiters: 19.4 } },
    ],
  },
  {
    name: "Packing Cube",
    itemType: "Dry Bag / Stuff Sack",
    description: "An ultralight packing cube for organizing clothing inside a pack.",
    base: { closureType: "Zip" },
    axisName: "Size",
    defaultKey: "Standard",
    variants: [
      { key: "Standard", g: 28, sourceId: 15174 },
      { key: "Large", g: 37, sourceId: 18444 },
    ],
  },
];

// ---------------------------------------------------------------------------
// FANNY PACK / POUCHES (no clean itemType match for the pouches -> Other)
// ---------------------------------------------------------------------------
const POUCHES = [
  {
    name: "Fanny Pack",
    itemType: "Hip Pack",
    description: "An ultralight fanny pack with a waterproof YKK zipper and stretchy front mesh pocket — pairs well with frameless packs that lack a padded hip belt.",
    base: { volumeLiters: 1.4, waterResistant: true, keyHook: false },
    weightGrams: 43,
    sourceId: 8019,
  },
  {
    name: "Shoulder Pouch",
    itemType: "Other",
    description: "A small Ultra 200X shoulder pouch for carrying essentials.",
    weightGrams: 12,
    sourceId: 3585,
  },
  {
    name: "Stretch Mesh Shoulder Pouch",
    itemType: "Other",
    description: "A stretch-mesh shoulder pouch in UltraGrid and nylon/spandex stretch mesh.",
    weightGrams: 22,
    sourceId: 23784,
  },
  {
    name: "Hip Belt Pocket",
    itemType: "Other",
    description: "A zippered Ultra 200X pocket that attaches to a padded hip belt.",
    weightGrams: 20,
    sourceId: 3581,
  },
];

// ---------------------------------------------------------------------------
// APPAREL
// ---------------------------------------------------------------------------
const APPAREL = [
  {
    name: "Alphus Pullover Hoodie",
    itemType: "Fleece Jacket",
    description: "A zipperless Polartec Alpha Direct pullover mid-layer — balaclava-style hood, high-coverage collar, built for the most weight-efficient active insulation possible.",
    base: { gender: "Unisex", fleeceType: "Alpha Direct", material: "Polartec Alpha Direct 90g", closure: "Pullover", hoodType: "Fixed Hood" },
    axisName: "Size",
    defaultKey: "M",
    variants: [
      { key: "S", g: 122, sourceId: 22906 },
      { key: "M", g: 131, sourceId: 22910 },
      { key: "L", g: 142, sourceId: 22914 },
      { key: "XL", g: 150, sourceId: 22918 },
    ],
  },
  {
    name: "Alphus Full Zip Hoodie",
    itemType: "Fleece Jacket",
    description: "A full-zip Polartec Alpha Direct mid-layer — smooth-running YKK reverse zipper, built for the most weight-efficient active insulation possible.",
    base: { gender: "Unisex", fleeceType: "Alpha Direct", material: "Polartec Alpha Direct 90g", closure: "Full-Zip", hoodType: "Fixed Hood" },
    axisName: "Size",
    defaultKey: "M",
    variants: [
      { key: "S", g: 136, sourceId: 22802 },
      { key: "M", g: 146, sourceId: 22806 },
      { key: "L", g: 157, sourceId: 22810 },
      { key: "XL", g: 165, sourceId: 22814 },
    ],
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const productCache = new Map();
  const getProduct = async (id) => {
    if (!productCache.has(id)) productCache.set(id, await fetchProduct(id));
    return productCache.get(id);
  };

  let created = 0;
  const ALL = [...PACKS, ...SHELTERS, ...INNERNETS, ...TENT_ACCESSORIES, ...BAGS, ...POUCHES, ...APPAREL];
  for (const m of ALL) {
    const existing = await C.findOne({ name: m.name, brand: /bonfus/i }).lean();
    if (existing) {
      console.log(`${m.name}: already exists — skip`);
      continue;
    }

    let axes = [];
    let variants = [];
    let defWeight = m.weightGrams;
    let defImages = [];
    let defDeepLink;
    let defAttrsExtra = {};

    if (m.axisName) {
      axes = [{ name: m.axisName, values: m.variants.map((v) => v.key) }];
      const sharedImages = m.imagesSourceId ? (await getProduct(m.imagesSourceId)).images.map((i) => i.src).slice(0, 10) : null;
      for (const v of m.variants) {
        const prod = await getProduct(v.sourceId);
        const images = sharedImages || (prod.images || []).map((i) => i.src).slice(0, 10);
        variants.push({
          key: v.key,
          options: { [m.axisName]: v.key },
          weightGrams: v.g,
          attributes: v.attrs || {},
          imageUrls: images.length ? images : undefined,
          deepLink: prod.permalink,
        });
      }
      const def = variants.find((v) => v.key === m.defaultKey) || variants[0];
      defWeight = def.weightGrams;
      defImages = def.imageUrls || [];
      defDeepLink = def.deepLink;
      defAttrsExtra = def.attributes || {};
    } else {
      const prod = await getProduct(m.sourceId);
      defImages = (prod.images || []).map((i) => i.src).slice(0, 10);
      defDeepLink = prod.permalink;
    }

    const attributes = m.base || Object.keys(defAttrsExtra).length ? { ...(m.base || {}), ...defAttrsExtra } : undefined;
    const itemType = m.itemType || "Backpack";
    const isFleece = itemType === "Fleece Jacket";
    const [category, subcategory] = isFleece ? ["Unisex Clothing", "Jackets"] : CATEGORY_BY_TYPE[itemType] || [];

    console.log(
      `${m.name.padEnd(32)} ${itemType.padEnd(20)} ${defWeight ?? "?"}g  imgs:${defImages.length}  ${
        m.axisName ? `${m.axisName}[${variants.map((v) => v.key + "=" + (v.weightGrams ?? "?")).join(", ")}]` : "one-size"
      }`
    );

    if (COMMIT) {
      if (!defImages.length) {
        console.log(`   !! ${m.name}: no images (source ${m.sourceId || m.variants?.[0]?.sourceId}) — skip`);
        continue;
      }
      const doc = new C({
        name: m.name,
        brand: "Bonfus",
        itemType,
        ...(category ? { category, subcategory } : {}),
        description: m.description,
        imageUrls: defImages,
        createdBy: ADMIN_ID,
        isActive: true,
        ...(defWeight != null ? { weightGrams: defWeight } : {}),
        ...(axes.length ? { variantAxes: axes, variants, defaultVariantKey: m.defaultKey } : {}),
        ...(attributes ? { attributes } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try {
        await doc.save();
      } catch (e) {
        console.log(`   !! ${m.name}: ${e.message}`);
        continue;
      }
      await O.create({
        network: "direct",
        region: "global",
        merchantId: "direct-bonfus",
        merchantName: "Bonfus",
        productId: doc._id,
        deepLink: defDeepLink,
        priority: 0,
      });
      created++;
      console.log(`   ✓ created (_id ${doc._id}) + direct offer`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created`);
  await mongoose.disconnect();
})();
