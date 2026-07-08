/**
 * import-farlite-cumulus.js — fill the Cumulus sleeping-bag/quilt GAPS (user, 2026-07-03)
 * via farlite.fi (WooCommerce Store API). We already have the smaller Cumulus items from
 * GGG (Neo Quilt 150 / The Quilt 150 / Aerial / Vencer / Panyam / Spotter / Magic); these
 * are the bigger fills Farlite carries. Real total weights + comfort temps from Farlite
 * (⚠ Farlite lists everything twice EN+FI — pick the /en/ permalink). Farlite direct offers.
 *
 *   node src/scripts/import-farlite-cumulus.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// model regex → curated item (weights/temps from Farlite descriptions)
const ITEMS = [
  { re: /neo quilt 300/i, name: "Neo Quilt 300", itemType: "Quilt", g: 455,
    attributes: { insulationType: "Down", tempRatingC: 3, tempRatingF: 37, fillPower: 900, fillWeightG: 300 }, tags: ["Down", "900 FP", "3-Season", "Made in Poland"] },
  { re: /neo quilt 450/i, name: "Neo Quilt 450", itemType: "Quilt", g: 610,
    attributes: { insulationType: "Down", tempRatingC: -2, tempRatingF: 28, fillPower: 900, fillWeightG: 450 }, tags: ["Down", "900 FP", "3-Season", "Made in Poland"] },
  { re: /the quilt 300/i, name: "The Quilt 300", itemType: "Quilt", g: 495,
    attributes: { insulationType: "Down", tempRatingC: 3, tempRatingF: 37, fillPower: 900, fillWeightG: 300 }, tags: ["Down", "900 FP", "3-Season", "Made in Poland"] },
  { re: /the quilt 450/i, name: "The Quilt 450", itemType: "Quilt", g: 650,
    attributes: { insulationType: "Down", tempRatingC: -1, tempRatingF: 30, fillPower: 900, fillWeightG: 450 }, tags: ["Down", "900 FP", "3-Season", "Made in Poland"] },
  { re: /x-lite 400/i, name: "X-Lite 400 Sleeping Bag", itemType: "Sleeping Bag", g: 575,
    attributes: { insulationType: "Down", tempRatingC: -1, tempRatingF: 30, fillPower: 900, fillWeightG: 400, shape: "Mummy", gender: "Unisex", hoodType: "Insulated Hood" }, tags: ["Down", "900 FP", "3-Season", "Made in Poland"] },
  { re: /teneqa 1000/i, name: "Teneqa 1000 Sleeping Bag", itemType: "Sleeping Bag", g: 1510,
    attributes: { insulationType: "Down", tempRatingC: -19, tempRatingF: -2, fillPower: 850, fillWeightG: 1000, shape: "Mummy", gender: "Unisex", hoodType: "Insulated Hood" }, tags: ["Down", "850 FP", "Winter / 4-Season", "Made in Poland"] },
];

function cleanDesc(html) {
  let t = (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&deg;/g, "°").replace(/&#8217;|&rsquo;/g, "'").replace(/&#8211;|&#8212;/g, "-").replace(/\s+/g, " ").trim();
  return t.slice(0, 600);
}

(async () => {
  const r = await fetch("https://farlite.fi/wp-json/wc/store/v1/products?per_page=100&search=cumulus", { headers: { "User-Agent": UA } });
  const feed = await r.json();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0;

  for (const spec of ITEMS) {
    const existing = await C.findOne({ brand: /^cumulus$/i, name: spec.name });
    if (existing) { console.log(`  SKIP (exists): ${spec.name}`); skipped++; continue; }
    // pick the EN permalink among the EN+FI dupes
    const matches = feed.filter((p) => spec.re.test(p.name));
    const p = matches.find((x) => /\/en\//.test(x.permalink)) || matches[0];
    if (!p) { console.log(`  ! Farlite product not found: ${spec.name}`); continue; }
    const imgs = (p.images || []).map((i) => i.src).slice(0, 8);
    const { category, subcategory } = categoryForItemType(spec.itemType, spec.name);
    console.log(`  create: ${spec.name.padEnd(26)} [${spec.itemType}] ${spec.g}g imgs:${imgs.length}  ${p.permalink}`);
    if (!COMMIT) continue;
    const doc = new C({ brand: "Cumulus", name: spec.name, createdBy: ADMIN_ID });
    doc.itemType = spec.itemType; doc.category = category; doc.subcategory = subcategory;
    doc.isActive = true; doc.weightGrams = spec.g; doc.description = cleanDesc(p.description || p.short_description);
    doc.imageUrls = imgs; doc.tags = spec.tags; doc.attributes = spec.attributes;
    doc.$locals.lenientAttributes = true;
    await doc.save();
    await O.create({ network: "direct", region: "global", merchantId: "direct-farlite", merchantName: "Farlite", productId: doc._id, deepLink: p.permalink, priority: 0 });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY"} — created:${created} skipped:${skipped}`);
  await mongoose.disconnect();
})();
