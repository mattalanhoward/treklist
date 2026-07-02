/**
 * import-ggg-cumulus-tarptent.js — 2026-07-02. Selective GGG re-add for two no-feed
 * cottage brands (user: "we know we can't get those directly"): Cumulus (4 down
 * bags/quilts) + Tarptent (1 shelter — ProTrek, ≠ the already-curated Rainbow, which
 * is left untouched per the precedence rule).
 *
 * ⚠ WEIGHT-TRUST: GGG feed `grams` are reseller shipping weights (Panyam 1970 / Spotter
 * 1850 vs real 970/989) — IGNORED. Weights + temp ratings below are the REAL specs read
 * from each GGG product description. Images pulled from the feed; GGG direct offers.
 *
 *   node src/scripts/import-ggg-cumulus-tarptent.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// handle → curated item (weights/temps hand-read from GGG descriptions, NOT feed grams)
const ITEMS = {
  "panyam-600-sleeping-bag-by-cumulus": {
    brand: "Cumulus", name: "Panyam 600 Sleeping Bag", itemType: "Sleeping Bag", weightGrams: 970,
    attributes: { insulationType: "Down", tempRatingF: 21, tempRatingC: -6, fillPower: 850, fillWeightG: 601, shape: "Mummy", gender: "Unisex", hoodType: "Insulated Hood" },
    tags: ["Down", "850 FP", "3-Season", "Made in Poland"],
  },
  "spotter-600-by-cumulus": {
    brand: "Cumulus", name: "Spotter 600", itemType: "Sleeping Bag", weightGrams: 989,
    attributes: { insulationType: "Down", tempRatingF: 18, tempRatingC: -7, fillPower: 850, fillWeightG: 601, shape: "Mummy", gender: "Unisex" },
    tags: ["Down", "850 FP", "3-Season", "Made in Poland"],
  },
  "neo-quilt-150-by-cumulus": {
    brand: "Cumulus", name: "Neo Quilt 150", itemType: "Quilt", weightGrams: 269,
    attributes: { insulationType: "Down", tempRatingF: 46, tempRatingC: 8, fillPower: 900, fillWeightG: 150 },
    tags: ["Down", "900 FP", "Summer", "Made in Poland"],
  },
  "the-quilt-by-cumulus": {
    brand: "Cumulus", name: "The Quilt 150", itemType: "Quilt", weightGrams: 300,
    attributes: { insulationType: "Down", tempRatingF: 48, tempRatingC: 9, fillPower: 900, fillWeightG: 150 },
    tags: ["Down", "900 FP", "Summer", "Made in Poland"],
  },
  "protrek-by-tarptent": {
    brand: "Tarptent", name: "ProTrek", itemType: "Backpacking Tent", weightGrams: 667,
    attributes: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles" },
    tags: ["Trekking Pole Tent", "Single Wall", "1-Person"],
  },
};

function cleanDesc(html) {
  let t = (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&deg;|&#176;/g, "°").replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/\s+/g, " ").trim();
  t = t.replace(/^.*?Est\.\s*\d{4}\s*/i, ""); // drop reseller "Ships in… Based in… Est. 19XX" preamble
  t = t.split(/\s(?:Specs|Specifications|Weight:|Dimensions:|Packed Size:|Features:)\b/i)[0].trim();
  return t.slice(0, 600);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0;

  for (const [handle, spec] of Object.entries(ITEMS)) {
    const existing = await C.findOne({ brand: new RegExp(`^${spec.brand}$`, "i"), name: spec.name });
    if (existing) { console.log(`  SKIP (exists, precedence): ${spec.brand} | ${spec.name}`); skipped++; continue; }

    const r = await fetch(`https://www.garagegrowngear.com/products/${handle}.json`, { headers: { "User-Agent": UA } });
    const p = (await r.json()).product;
    const imgs = (p.images || []).map((i) => i.src).slice(0, 10);
    const desc = cleanDesc(p.body_html);
    const { category, subcategory } = categoryForItemType(spec.itemType, spec.name);
    console.log(`  create: ${spec.brand} | ${spec.name}  [${spec.itemType}] ${spec.weightGrams}g  imgs:${imgs.length}`);
    if (!COMMIT) continue;

    const doc = new C({ brand: spec.brand, name: spec.name, createdBy: ADMIN_ID });
    doc.itemType = spec.itemType; doc.category = category; doc.subcategory = subcategory;
    doc.isActive = true;
    doc.weightGrams = spec.weightGrams;
    doc.description = desc;
    doc.imageUrls = imgs;
    doc.tags = spec.tags;
    doc.attributes = spec.attributes;
    doc.$locals.lenientAttributes = true;
    await doc.save();

    await O.create({ network: "direct", region: "global", merchantId: "direct-ggg", merchantName: "Garage Grown Gear", productId: doc._id, deepLink: `https://www.garagegrowngear.com/products/${handle}`, priority: 0 });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — created:${created} skipped:${skipped}`);
  await mongoose.disconnect();
})();
