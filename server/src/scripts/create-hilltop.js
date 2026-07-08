/**
 * create-hilltop.js — add the relevant Hilltop Packs items (Shopify, open feed) and
 * skip the 240+ noise products (stickers, custom/bargain prints, apparel, hardware,
 * resold flashlights). User-selected keep set (2026-07-01):
 *   6 packs (3 Ravens → ONE Fabric-variant item, Dirty 30, 24Seven, Outlaw 35),
 *   Roll Top Fanny Pack (Fabric[Ecopak/Dyneema]), RFP Pillow, Bear Bag Throw Kit.
 *
 * Weights = each product's PUBLISHED BASE/LIGHTEST config from its page (Hilltop lists
 * ranges "depending on options"); the feed `grams` looked like placeholders (Raven
 * D & ECO both 680). Torso-size packs have no per-size weight published → flat weight.
 * Images pulled live from the feed. Direct (unmonetized) buy-links to hilltoppacks.com.
 *
 *   node src/scripts/create-hilltop.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const oz = (o) => Math.round(o * 28.3495);

// imageHandle = which product's photos to use (for Fabric-variant items = the default).
const MODELS = [
  {
    name: "Raven",
    itemType: "Backpack",
    category: "Backpacks & Bags",
    subcategory: "Backpacking Packs",
    imageHandle: "raven-d-v4-ultralight-backpack",
    offerHandle: "raven-d-v4-ultralight-backpack",
    description:
      "An ultralight frameless roll-top backpack (~40 L, 44 L with extension), offered in three premium fabrics. Removable hip belt; torso size does not affect volume.",
    base: {
      gender: "Unisex",
      volumeLiters: 40,
      frameType: "Frameless",
      hipBeltType: "Webbing Only",
      hipBeltRemovable: true,
      waterResistance: "Water Resistant",
      loadCapacityKg: 13.6, // comfort rating ~25–30 lb
    },
    axisName: "Fabric",
    defaultKey: "Dyneema",
    variants: [
      { key: "Dyneema", g: oz(19), attrs: { mainFabric: "DCF (Dyneema Composite)" } },
      { key: "Ecopak", g: oz(20), attrs: { mainFabric: "Ecopak EPLX200" } },
      { key: "X-Pac", g: oz(28), attrs: { mainFabric: "X-Pac VX21" } },
    ],
  },
  {
    name: "Dirty 30",
    itemType: "Backpack",
    category: "Backpacks & Bags",
    subcategory: "Backpacking Packs",
    imageHandle: "dirty-30-eplx200-ultralight-backpack",
    offerHandle: "dirty-30-eplx200-ultralight-backpack",
    description:
      "A 33 L ultralight frameless backpack in durable Ecopak EPLX200 — minimal weight without sacrificing function.",
    base: {
      gender: "Unisex",
      volumeLiters: 33,
      frameType: "Frameless",
      hipBeltType: "Webbing Only",
      hipBeltRemovable: true,
      waterResistance: "Water Resistant",
      mainFabric: "Ecopak EPLX200",
      loadCapacityKg: 13.6,
    },
    weightGrams: oz(15),
  },
  {
    name: "24Seven Trail",
    itemType: "Backpack",
    category: "Backpacks & Bags",
    subcategory: "Backpacking Packs",
    imageHandle: "24seven-trail-edition-backpack-1",
    offerHandle: "24seven-trail-edition-backpack-1",
    description:
      "A 24 L lightweight single-strap everyday hiking pack in X-Pac VX21/VX07. Torso-sized fit; color collapsed (weight-neutral).",
    base: {
      gender: "Unisex",
      volumeLiters: 24,
      frameType: "Frameless",
      hipBeltType: "None",
      waterResistance: "Water Resistant",
      mainFabric: "X-Pac VX21/VX07",
    },
    axisName: "Torso Size",
    defaultKey: '18"',
    variants: ['16"', '18"', '20"', '22"'].map((k) => ({ key: k, g: oz(15) })), // flat: no per-size weight published
  },
  {
    name: "Outlaw 35 Venom",
    itemType: "Backpack",
    category: "Backpacks & Bags",
    subcategory: "Backpacking Packs",
    imageHandle: "outlaw-35-venom-ultralight-backpack",
    offerHandle: "outlaw-35-venom-ultralight-backpack",
    description:
      "A 35 L ultralight frameless backpack in solution-dyed X-Pac. Torso-sized fit; hip-belt option collapsed to base (no padded belt).",
    base: {
      gender: "Unisex",
      volumeLiters: 35,
      frameType: "Frameless",
      hipBeltType: "Webbing Only",
      waterResistance: "Water Resistant",
      mainFabric: "X-Pac",
      loadCapacityKg: 13.6,
    },
    axisName: "Torso Size",
    defaultKey: "Medium",
    variants: ["Small", "Medium", "Large", "Extra Large"].map((k) => ({ key: k, g: oz(17) })),
  },
  {
    name: "Ultralight Roll Top Fanny Pack",
    itemType: "Hip Pack",
    category: "Backpacks & Bags",
    subcategory: "Day Packs & Accessories",
    imageHandle: "roll-top-fanny-pack-ecopak",
    offerHandle: "roll-top-fanny-pack-ecopak",
    description:
      "An expandable roll-top fanny pack (~3–4 L) offered in two ultralight fabrics.",
    base: { volumeLiters: 3, waterResistant: true },
    axisName: "Fabric",
    defaultKey: "Ecopak",
    variants: [
      { key: "Ecopak", g: oz(3.0), attrs: { mainFabric: "Ecopak" } },
      { key: "Dyneema", g: oz(2.18), attrs: { mainFabric: "DCF (Dyneema Composite)" } },
    ],
  },
  {
    name: "RFP Pillow",
    itemType: "Pillow",
    category: "Sleep System",
    subcategory: "Pillows",
    imageHandle: "rfp-pillow-by-hilltop-packs",
    offerHandle: "rfp-pillow-by-hilltop-packs",
    description:
      "An ultralight backpacking pillow you stuff with spare clothing for a packable, compressible headrest.",
    base: {
      bestUse: "Backpacking",
      pillowType: "Stuff Sack",
      pillowFill: "Compressible",
      inflatable: false,
    },
    axisName: "Size",
    defaultKey: "Small",
    variants: [
      { key: "Small", g: oz(7) },
      { key: "Large", g: oz(11) },
    ],
  },
  {
    name: "Ultralight Bear Bag Throw Kit",
    itemType: "Other",
    category: "Accessories & Tools",
    imageHandle: "rock-sack-kits-bear-bag-throw-kit",
    offerHandle: "rock-sack-kits-bear-bag-throw-kit",
    description:
      "A food-hang kit: rock sack + throw cord + toggle for hanging food using the PCT method.",
    weightGrams: 62,
    // itemType "Other" has no attribute schema → don't set attributes (would be stripped).
  },
];

async function loadFeed() {
  const byHandle = {};
  for (const page of [1, 2]) {
    const res = await fetch(`https://hilltoppacks.com/products.json?limit=250&page=${page}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const j = await res.json();
    for (const p of j.products || []) byHandle[p.handle] = p;
  }
  return byHandle;
}

(async () => {
  const feed = await loadFeed();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0;
  for (const m of MODELS) {
    const existing = await C.findOne({ name: m.name, brand: /hilltop/i }).lean();
    if (existing) {
      console.log(`${m.name}: already exists — skip`);
      continue;
    }
    const prod = feed[m.imageHandle];
    const images = (prod?.images || []).map((i) => i.src).slice(0, 10);
    const deepLink = `https://hilltoppacks.com/products/${m.offerHandle}`;

    let axes = [];
    let variants = [];
    let defWeight = m.weightGrams;
    let defAttrsExtra = {};
    if (m.axisName) {
      axes = [{ name: m.axisName, values: m.variants.map((v) => v.key) }];
      variants = m.variants.map((v) => ({
        key: v.key,
        options: { [m.axisName]: v.key },
        weightGrams: v.g,
        attributes: v.attrs || {},
      }));
      const def = variants.find((v) => v.key === m.defaultKey) || variants[0];
      defWeight = def.weightGrams;
      defAttrsExtra = def.attributes || {};
    }
    const attributes = m.base ? { ...m.base, ...defAttrsExtra } : undefined;

    console.log(`${m.name.padEnd(30)} ${m.itemType.padEnd(10)} ${defWeight}g  imgs:${images.length}  ${m.axisName ? `${m.axisName}[${variants.map((v) => v.key + "=" + v.weightGrams).join(", ")}]` : "one-size"}`);

    if (COMMIT) {
      if (!images.length) {
        console.log(`   !! ${m.name}: no images from feed (${m.imageHandle}) — skip`);
        continue;
      }
      const doc = new C({
        name: m.name,
        brand: "Hilltop Packs",
        itemType: m.itemType,
        category: m.category,
        subcategory: m.subcategory,
        description: m.description,
        imageUrls: images,
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
        merchantId: "direct-hilltop",
        merchantName: "Hilltop Packs",
        productId: doc._id,
        deepLink,
        priority: 0,
      });
      created++;
      console.log(`   ✓ created (_id ${doc._id}) + direct offer`);
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created`);
  await mongoose.disconnect();
})();
