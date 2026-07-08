/**
 * import-ggg-cumulus-rest.js — 2026-07-02. The remaining 6 Cumulus the trimmed feed hid
 * (found via /collections/cumulus/products.json). Real TOTAL weights + comfort temps read
 * from GGG descriptions — feed grams here were the DOWN-FILL weight (Aerial 38/46/60g) or
 * otherwise bogus, NOT the bag. fill weight matches the model number (Aerial 180=184g etc).
 * All 900FP Polish goose down. GGG direct offers.
 *
 *   node src/scripts/import-ggg-cumulus-rest.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// hoodless = the Aerial quilt/bag hybrids + Vencer half-bags (waist-down)
const ITEMS = {
  "aerial-180-sleeping-bag-by-cumulus": { brand: "Cumulus", name: "Aerial 180 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 300,
    attributes: { insulationType: "Down", tempRatingF: 39, tempRatingC: 4, fillPower: 900, fillWeightG: 184, shape: "Mummy", gender: "Unisex", hoodType: "Hoodless" }, tags: ["Down", "900 FP", "Quilt/Bag Hybrid", "Made in Poland"] },
  "aerial-250-sleeping-bag-by-cumulus": { brand: "Cumulus", name: "Aerial 250 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 383,
    attributes: { insulationType: "Down", tempRatingF: 35, tempRatingC: 2, fillPower: 900, fillWeightG: 250, shape: "Mummy", gender: "Unisex", hoodType: "Hoodless" }, tags: ["Down", "900 FP", "Quilt/Bag Hybrid", "Made in Poland"] },
  "aerial-sleeping-bag-by-cumulus": { brand: "Cumulus", name: "Aerial 330 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 482,
    attributes: { insulationType: "Down", tempRatingF: 30, tempRatingC: -1, fillPower: 900, fillWeightG: 329, shape: "Mummy", gender: "Unisex", hoodType: "Hoodless" }, tags: ["Down", "900 FP", "Quilt/Bag Hybrid", "Made in Poland"] },
  "magic-125-by-cumulus": { brand: "Cumulus", name: "Magic 100 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 240,
    attributes: { insulationType: "Down", tempRatingF: 55, tempRatingC: 13, fillPower: 900, fillWeightG: 105, shape: "Mummy", gender: "Unisex" }, tags: ["Down", "900 FP", "Summer", "Made in Poland"] },
  "vencer-100-sleeping-bag-by-cumulus": { brand: "Cumulus", name: "Vencer 100 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 180,
    attributes: { insulationType: "Down", tempRatingF: 48, tempRatingC: 9, fillPower: 900, fillWeightG: 99, shape: "Mummy", gender: "Unisex", hoodType: "Hoodless" }, tags: ["Down", "900 FP", "Half Bag", "Made in Poland"] },
  "vencer-200-sleeping-bag-by-cumulus": { brand: "Cumulus", name: "Vencer 200 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 375,
    attributes: { insulationType: "Down", tempRatingF: 35, tempRatingC: 2, fillPower: 900, fillWeightG: 200, shape: "Mummy", gender: "Unisex", hoodType: "Hoodless" }, tags: ["Down", "900 FP", "Half Bag", "Made in Poland"] },
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
    const existing = await C.findOne({ brand: /^cumulus$/i, name: spec.name });
    if (existing) { console.log(`  SKIP (exists): ${spec.name}`); skipped++; continue; }
    const r = await fetch(`https://www.garagegrowngear.com/products/${handle}.json`, { headers: { "User-Agent": UA } });
    const p = (await r.json()).product;
    const imgs = (p.images || []).map((i) => i.src).slice(0, 10);
    const { category, subcategory } = categoryForItemType(spec.itemType, spec.name);
    console.log(`  create: Cumulus | ${spec.name.padEnd(26)} ${spec.weightGrams}g  ${spec.attributes.tempRatingF}°F  imgs:${imgs.length}`);
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
