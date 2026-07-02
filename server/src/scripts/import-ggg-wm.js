/**
 * import-ggg-wm.js — Western Mountaineering via GGG (their own Woo Store API is broken →
 * GGG is the back-door). User asked for the sleeping bags + quilt + liner (NOT the booties).
 * Real TOTAL weights + fill from descriptions (feed grams inflated: VersaLite 1125 vs real
 * 850). All 850FP goose down. GGG direct offers. Existing WM in catalog: 0.
 *
 *   node src/scripts/import-ggg-wm.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const ITEMS = {
  "versalite-by-western-mountaineering": { brand: "Western Mountaineering", name: "VersaLite 10°F Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 850, // 30oz total
    attributes: { insulationType: "Down", tempRatingF: 10, tempRatingC: -12, fillPower: 850, fillWeightG: 510, shape: "Mummy", gender: "Unisex", hoodType: "Insulated Hood" }, tags: ["Down", "850 FP", "3-Season", "Made in USA"] },
  "ultralite-by-western-mountaineering": { brand: "Western Mountaineering", name: "UltraLite 20°F Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 794, // 28oz total
    attributes: { insulationType: "Down", tempRatingF: 20, tempRatingC: -7, fillPower: 850, fillWeightG: 425, shape: "Mummy", gender: "Unisex", hoodType: "Insulated Hood" }, tags: ["Down", "850 FP", "3-Season", "Made in USA"] },
  "flylite-by-western-mountaineering": { brand: "Western Mountaineering", name: "FlyLite 36°F Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 383, // 13.5oz total
    attributes: { insulationType: "Down", tempRatingF: 36, tempRatingC: 2, fillPower: 850, fillWeightG: 203, shape: "Mummy", gender: "Unisex", hoodType: "Insulated Hood" }, tags: ["Down", "850 FP", "Summer", "Made in USA"] },
  "nanolite-by-western-mountaineering": { brand: "Western Mountaineering", name: "NanoLite 38°F Quilt", itemType: "Quilt", weightGrams: 371, // 13.1oz total
    attributes: { insulationType: "Down", tempRatingF: 38, tempRatingC: 3, fillPower: 850, fillWeightG: 184 }, tags: ["Down", "850 FP", "Summer", "Made in USA"] },
  "tioga-sleep-liner-by-western-mountaineering": { brand: "Western Mountaineering", name: "Tioga Sleep Liner", itemType: "Sleeping Bag Liner", weightGrams: 102, // 3.6oz Mummy Regular
    attributes: { material: "Silk", shape: "Mummy", lengthSize: "Regular", packable: true }, tags: ["Silk", "Travel", "Made in USA"] },
};

function cleanDesc(html) {
  let t = (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&deg;|&#176;/g, "°").replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/\s+/g, " ").trim();
  t = t.replace(/^.*?Est\.\s*\d{4}\s*/i, "");
  t = t.split(/\s(?:Specs|Specifications|Weight:|Dimensions:|Packed Size:|Features:)\b/i)[0].trim();
  return t.slice(0, 600);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0;
  for (const [handle, spec] of Object.entries(ITEMS)) {
    const existing = await C.findOne({ brand: /^western mountaineering$/i, name: spec.name });
    if (existing) { console.log(`  SKIP (exists): ${spec.name}`); skipped++; continue; }
    const r = await fetch(`https://www.garagegrowngear.com/products/${handle}.json`, { headers: { "User-Agent": UA } });
    const p = (await r.json()).product;
    const imgs = (p.images || []).map((i) => i.src).slice(0, 10);
    const { category, subcategory } = categoryForItemType(spec.itemType, spec.name);
    console.log(`  create: ${spec.name.padEnd(28)} [${spec.itemType}] ${spec.weightGrams}g  imgs:${imgs.length}`);
    if (!COMMIT) continue;
    const doc = new C({ brand: spec.brand, name: spec.name, createdBy: ADMIN_ID });
    doc.itemType = spec.itemType; doc.category = category; doc.subcategory = subcategory;
    doc.isActive = true; doc.weightGrams = spec.weightGrams; doc.description = cleanDesc(p.body_html);
    doc.imageUrls = imgs; doc.tags = spec.tags; doc.attributes = spec.attributes;
    doc.$locals.lenientAttributes = true;
    await doc.save();
    await O.create({ network: "direct", region: "global", merchantId: "direct-ggg", merchantName: "Garage Grown Gear", productId: doc._id, deepLink: `https://www.garagegrowngear.com/products/${handle}`, priority: 0 });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — created:${created} skipped:${skipped}`);
  await mongoose.disconnect();
})();
