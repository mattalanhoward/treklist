/**
 * create-liteaf.js — LiteAF (liteaf.com), WooCommerce Store API (open, no auth).
 * Targeted create (NOT the generic ingest importer): the generic Woo path collapses
 * variable products to ONE flat item using the parent "weight" field, which is a
 * rounded SHIPPING weight here (e.g. 24 oz on a pack whose description says 13.2 oz
 * real) — unusable. Real weights live in each product's description text instead
 * (per-size or per-fabric "WEIGHTS & MEASUREMENTS" tables), hand-read per item below.
 *
 * Scope decisions (2026-07-08):
 * - Dropped ALL 18 "...Custom Backpack" listings — build-to-order against a chosen
 *   fabric+volume+torso combo, no fixed spec/weight to catalog.
 * - The remaining ~30 ready-to-ship "Curve" backpack SKUs are literally individual
 *   hand-sewn units currently in stock (fragmented one-off torso/color combos, not a
 *   clean size grid) → consolidated to product identity = Volume × Frame Type
 *   (Curve 20L Frameless, Curve 30L Frameless, Curve 40L Frameless, Curve 40L Full
 *   Suspension, Curve 46L Full Suspension), variant axis = Fabric (color dropped,
 *   torso dropped — too noisy/non-monotonic across hand-made units to trust a matrix).
 *   Representative weight per fabric picked from the cleanest single-color listing
 *   at that fabric (see per-item comments for source SKU).
 * - Multi-Day 35L / 20L are real Woo variable products (Torso Size / Color) with
 *   clean per-size weight tables in the parent description — kept as designed.
 * - Kept the small-gear line (ditty/food bags, bear bag, pot sacks, stuff sacks,
 *   wallets, first aid pouch, fanny packs, pack liner, pack towel, hip belt pocket)
 *   — real LiteAF gear, not accessories-in-the-excluded sense. Excluded: gift card,
 *   pin/sticker/beanie/trucker hat/canvas tote (merch), carabiner/sternum-strap/hip-
 *   belt replacement/stick-em tabs (spare parts), phone pouch (EDC not backpacking),
 *   2 duplicate fanny-pack listings (48983, 47104 — same product as #53, re-listed).
 * - Fabric axis values normalized: "Ultra"/"UltraWeave" + no "X" → "UltraWeave 200";
 *   "+X" → "UltraWeave 200X"; "ECOPAK"/"ECOPAK EPLX" kept distinct (EPLX = print
 *   laminate). Color dropped everywhere per the locked variant standard.
 *
 *   node src/scripts/create-liteaf.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const BASE = "https://liteaf.com/wp-json/wc/store/v1/products";

// category/subcategory isn't auto-derived on save() — set explicitly (matches
// CATEGORY_BY_ITEM_TYPE in src/config/inferItemType.js). "Other" left unset.
const CATEGORY_BY_TYPE = {
  Backpack: ["Backpacks & Bags", "Backpacking Packs"],
  Daypack: ["Backpacks & Bags", "Day Packs & Accessories"],
  "Hip Pack": ["Backpacks & Bags", "Day Packs & Accessories"],
  "Dry Bag / Stuff Sack": ["Accessories & Tools", "Dry Bags"],
  "Pack Liner": ["Accessories & Tools", "Dry Bags"],
  "First Aid Kit": ["Health & Hygiene", "First Aid"],
  "Travel Towel": ["Travel", "Towels"],
  Wallet: ["Travel", "Wallet"],
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
// BACKPACKS — item identity = Volume × Frame Type, variant axis = Fabric.
// ---------------------------------------------------------------------------
const BACKPACKS = [
  {
    name: "Curve 20L Frameless",
    description:
      "A 20L frameless ultralight backpack (30L total w/ external pockets), sized for small load-outs, day hikes or a quick overnight. Fits carry-on.",
    base: { gender: "Unisex", volumeLiters: 20, frameType: "Frameless", hipBeltType: "None", hipBeltRemovable: true, loadCapacityKg: 9 },
    axisName: "Fabric",
    defaultKey: "UltraWeave 200",
    variants: [
      { key: "UltraWeave 200", g: 374, sourceId: 48406, attrs: { mainFabric: "UltraWeave 200" } },
      { key: "UltraWeave 200X", g: 391, sourceId: 48391, attrs: { mainFabric: "UltraWeave 200X" } },
      { key: "ECOPAK", g: 493, sourceId: 44029, attrs: { mainFabric: "ECOPAK" } },
    ],
  },
  {
    name: "Curve 30L Frameless",
    description: "A 30L frameless ultralight backpack for small load-outs, day hikes or overnight trips.",
    base: { gender: "Unisex", volumeLiters: 30, frameType: "Frameless", hipBeltType: "None", hipBeltRemovable: true },
    weightGrams: 538,
    sourceId: 44028,
    attrs: { mainFabric: "ECOPAK" },
  },
  {
    name: "Curve 40L Frameless",
    description: "A 40L frameless ultralight backpack — the comfort of a hip-belt attachment without a built-in frame.",
    base: { gender: "Unisex", volumeLiters: 40, frameType: "Frameless", hipBeltType: "None", hipBeltRemovable: true },
    weightGrams: 672,
    sourceId: 43723,
    attrs: { mainFabric: "UltraWeave 200X" },
  },
  {
    name: "Curve 40L Full Suspension",
    description: "A 40L internal-frame ultralight backpack with a full padded, removable hip belt.",
    base: { gender: "Unisex", volumeLiters: 40, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true },
    axisName: "Fabric",
    defaultKey: "ECOPAK",
    variants: [
      { key: "ECOPAK", g: 941, sourceId: 43852, attrs: { mainFabric: "ECOPAK" } },
      { key: "UltraWeave 200X", g: 819, sourceId: 43690, attrs: { mainFabric: "UltraWeave 200X" } },
    ],
  },
  {
    name: "Curve 46L Full Suspension",
    description: "A 46L internal-frame ultralight backpack — 4\" more roll-top and load lifters vs. the 40L Curve, full padded removable hip belt.",
    base: { gender: "Unisex", volumeLiters: 46, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true },
    axisName: "Fabric",
    defaultKey: "ECOPAK",
    variants: [
      { key: "ECOPAK", g: 969, sourceId: 44119, attrs: { mainFabric: "ECOPAK" } },
      { key: "UltraWeave 200X", g: 1004, sourceId: 44031, attrs: { mainFabric: "UltraWeave 200X" } },
      { key: "UltraWeave 200", g: 1009, sourceId: 42796, attrs: { mainFabric: "UltraWeave 200" } },
    ],
  },
  {
    name: "Multi-Day 35L",
    description:
      "A 35L frameless backpack (45L with external pockets) built for a fully-loaded ultralight kit at a budget price. Imported, not hand-sewn like LiteAF's Curve line.",
    base: { gender: "Unisex", volumeLiters: 35, frameType: "Frameless", hipBeltType: "None", hipBeltRemovable: true, loadCapacityKg: 9 },
    axisName: "Torso Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", g: 473, sourceId: 42485 },
      { key: "Medium", g: 476, sourceId: 42484 },
      { key: "Large", g: 476, sourceId: 42483 },
    ],
  },
  {
    name: "Multi-Day 20L Daypack",
    itemType: "Daypack",
    description: "A 20L frameless daypack for a day hike or a market run — the smaller sibling of the Multi-Day 35L.",
    base: { gender: "Unisex", volumeLiters: 20, frameType: "Frameless", hipBeltType: "None" },
    weightGrams: 363,
    sourceId: 49879,
  },
];

// ---------------------------------------------------------------------------
// SMALL GEAR — bags, pouches, fanny packs, liner, towel.
// ---------------------------------------------------------------------------
const GEAR = [
  {
    name: "UltraTenX Ditty & Food Bags",
    itemType: "Dry Bag / Stuff Sack",
    description: "Zippered flat-bottom ditty bags in three sizes — first aid/toiletries (S), electronics (M), 3-4 days of food (L).",
    base: { material: "UltraTenX", waterproof: false, seamSealed: true, closureType: "Zip" },
    axisName: "Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", g: 13, sourceId: 51661, attrs: { volumeLiters: 1 } },
      { key: "Medium", g: 25, sourceId: 51660, attrs: { volumeLiters: 3.5 } },
      { key: "Large", g: 38, sourceId: 51659, attrs: { volumeLiters: 7 } },
    ],
  },
  {
    name: "Printed ULTRA TX50 Ditty Bag",
    itemType: "Dry Bag / Stuff Sack",
    description: "A roll-top toiletries ditty bag in printed ULTRA TX50 fabric.",
    base: { volumeLiters: 3.1, material: "Ultra TX50", closureType: "Roll-Top", seamSealed: true },
    weightGrams: 18,
    sourceId: 51610,
  },
  {
    name: "Flat Bottom Bear Bag / Food Bag",
    itemType: "Dry Bag / Stuff Sack",
    description: "A flat-bottom food bag for thru-hikers — holds ~5-7 days of food for one person, clip loop for hanging.",
    base: { volumeLiters: 19, closureType: "Buckle", seamSealed: true },
    axisName: "Fabric",
    defaultKey: "Dyneema",
    variants: [
      { key: "Dyneema", g: 37, sourceId: 141, attrs: { material: "Dyneema CT5K.18" } },
      { key: "Ultra TX50 Printed", g: 53, sourceId: 50555, attrs: { material: "Ultra TX50" } },
    ],
  },
  {
    name: "Round Bottom Pot Sacks",
    itemType: "Dry Bag / Stuff Sack",
    description: "Dyneema stuff sacks sized to specific pot models — wide mouth, top closes 75% to lock the lid in place.",
    base: { material: "Dyneema CT2K.18", closureType: "Drawcord", seamSealed: true },
    axisName: "Size",
    defaultKey: "#1",
    // volumeLiters computed from each size's published cylinder dims (brand doesn't state volume directly).
    variants: [
      { key: "#1", g: 4, sourceId: 153, attrs: { volumeLiters: 1.1 } },
      { key: "#2", g: 4, sourceId: 154, attrs: { volumeLiters: 0.9 } },
      { key: "#3", g: 5, sourceId: 37536, attrs: { volumeLiters: 1.7 } },
      { key: "#4", g: 4, sourceId: 37537, attrs: { volumeLiters: 1.2 } },
    ],
  },
  {
    name: "Small Dyneema Zipper Pouches (Hiker Wallets)",
    itemType: "Wallet",
    description: "A small water-resistant Dyneema/UltraTenX zipper pouch, sized as an ultralight wallet.",
    weightGrams: 6,
    sourceId: 31099,
  },
  {
    name: "UltraWeave Zipper Pouch (Large)",
    itemType: "Wallet",
    description: '"Travel size" zipper pouch for batteries, cables, phone, chargers, passport.',
    weightGrams: 20,
    sourceId: 41330,
  },
  {
    name: "Dyneema First Aid Zipper Pouch",
    itemType: "First Aid Kit",
    description: "A bright, water-resistant Dyneema zipper pouch sized for a DIY first aid kit.",
    axisName: "Size",
    defaultKey: "Medium",
    variants: [
      { key: "Small", g: 7, sourceId: 24305 },
      { key: "Medium", g: 11, sourceId: 690 },
      { key: "Large", g: 12, sourceId: 49798 },
    ],
  },
  {
    name: "Ultralight Dyneema Stuff Sacks",
    itemType: "Dry Bag / Stuff Sack",
    description: "General-purpose Dyneema stuff sacks for clothing, quilts or small items.",
    base: { material: "Dyneema", closureType: "Drawcord", seamSealed: true, waterproof: true },
    axisName: "Size",
    defaultKey: "Medium",
    // volumeLiters is a rough estimate from each size's published flat dims (brand states flat dims, not volume).
    variants: [
      { key: "Small", g: 8, sourceId: 48056, attrs: { volumeLiters: 3 } },
      { key: "Medium", g: 13, sourceId: 48057, attrs: { volumeLiters: 6 } },
      { key: "Large", g: 17, sourceId: 48058, attrs: { volumeLiters: 10 } },
    ],
  },
  {
    name: "Dyneema Wide Mouth Tent Stake Stuff Sack",
    itemType: "Dry Bag / Stuff Sack",
    description: "A wide-mouth Dyneema stuff sack for tent stakes, with a long drawcord to loop around stakes.",
    // volumeLiters is a rough estimate (brand publishes flat/tapered dims, not volume; this is a small, narrow pouch).
    base: { volumeLiters: 0.6, material: "Dyneema CT5K.18", closureType: "Drawcord", seamSealed: true },
    weightGrams: 5,
    sourceId: 46206,
  },
  {
    name: "Feather Weight Fanny Pack",
    itemType: "Hip Pack",
    description: "A 1.5L ultralight fanny pack with three pockets, water-resistant fabric, taped seams.",
    base: { volumeLiters: 1.5, waterResistant: true, keyHook: false },
    axisName: "Fabric",
    defaultKey: "UltraWeave 200X",
    variants: [
      { key: "UltraWeave 200X", g: 68, sourceId: 550, attrs: { mainFabric: "UltraWeave 200X" } },
      { key: "Dyneema", g: 65, sourceId: 244, attrs: { mainFabric: "Dyneema" } },
      { key: "ECOPAK EPLX200", g: 74, sourceId: 43656, attrs: { mainFabric: "ECOPAK EPLX200" } },
    ],
  },
  {
    name: "XL Eco-Friendly Fanny Pack",
    itemType: "Hip Pack",
    description: "A 2.1L extra-large ultralight fanny pack for extra capacity without extra weight — three pockets, detachable belt option.",
    base: { volumeLiters: 2.1, waterResistant: true, keyHook: false },
    axisName: "Fabric",
    defaultKey: "UltraWeave 200",
    variants: [
      { key: "UltraWeave 200", g: 74, sourceId: 45901, attrs: { mainFabric: "UltraWeave 200" } },
      { key: "UltraWeave 400", g: 77, sourceId: 45918, attrs: { mainFabric: "UltraWeave 400" } },
      { key: "ECOPAK EPLX200", g: 77, sourceId: 45902, attrs: { mainFabric: "ECOPAK EPLX200" } },
    ],
  },
  {
    name: "Nylofume Pack Liner",
    itemType: "Pack Liner",
    description: "A waterproof Nylofume pack liner — an odor-resistant barrier against a pack that may wet out.",
    base: { material: "Nylofume", closureType: "Roll-Top" },
    weightGrams: 26,
    sourceId: 13938,
  },
  {
    name: "Hitchhiker Pack Towel",
    itemType: "Travel Towel",
    description: '16"x16" microfiber pack towel with a grommet + shock cord to attach to a trekking pole or pack.',
    base: { size: "Small", material: "Microfiber", quickDry: true, packable: true },
    weightGrams: 38,
    sourceId: 30070,
  },
  {
    name: "UltraWeave Hip Belt Pocket / Pouch",
    itemType: "Other",
    description: 'A zippered pocket that attaches to any 4"+ wide padded hip belt via two slick clips. Sold individually, not as a pair.',
    weightGrams: 27,
    sourceId: 13573,
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
  for (const m of [...BACKPACKS, ...GEAR]) {
    const existing = await C.findOne({ name: m.name, brand: /liteaf/i }).lean();
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
      for (const v of m.variants) {
        const prod = await getProduct(v.sourceId);
        const images = (prod.images || []).map((i) => i.src).slice(0, 10);
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
      defAttrsExtra = m.attrs || {};
    }

    const attributes = m.base || Object.keys(defAttrsExtra).length ? { ...(m.base || {}), ...defAttrsExtra } : undefined;
    const itemType = m.itemType || "Backpack";

    console.log(
      `${m.name.padEnd(35)} ${itemType.padEnd(20)} ${defWeight}g  imgs:${defImages.length}  ${
        m.axisName ? `${m.axisName}[${variants.map((v) => v.key + "=" + v.weightGrams).join(", ")}]` : "one-size"
      }`
    );

    if (COMMIT) {
      if (!defImages.length) {
        console.log(`   !! ${m.name}: no images (source ${m.sourceId || m.variants?.[0]?.sourceId}) — skip`);
        continue;
      }
      const [category, subcategory] = CATEGORY_BY_TYPE[itemType] || [];
      const doc = new C({
        name: m.name,
        brand: "LiteAF",
        itemType,
        ...(category ? { category, subcategory } : {}),
        description: m.description,
        imageUrls: defImages,
        createdBy: ADMIN_ID,
        isActive: true,
        weightGrams: defWeight,
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
        merchantId: "direct-liteaf",
        merchantName: "LiteAF",
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
