/**
 * import-ggg-tarptent-rest.js — 2026-07-02. The node-fetch GGG products.json was
 * Cloudflare-TRIMMED (185 of ~full) so the first pass saw only 1 Tarptent. The
 * `/collections/tarptent/products.json` endpoint (via curl) shows 5: ProTrek (done)
 * + these 4. Real weights read from descriptions (feed grams inflated: Aeon Li 794 vs
 * real 478, Double Rainbow 1332 vs 1038, StratoSpire2 1474 vs 1244). Rainbow (existing)
 * untouched. GGG direct offers.
 *
 *   node src/scripts/import-ggg-tarptent-rest.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const ITEMS = {
  "aeon-li-by-tarptent": {
    brand: "Tarptent", name: "Aeon Li", itemType: "Backpacking Tent", weightGrams: 478, // 16.85 oz min
    attributes: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles", flyMaterial: "Dyneema DCF" },
    tags: ["Trekking Pole Tent", "Single Wall", "DCF", "1-Person"],
  },
  "double-rainbow-by-tarptent": {
    brand: "Tarptent", name: "Double Rainbow", itemType: "Backpacking Tent", weightGrams: 1038, // 36.6 oz
    attributes: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Semi-Freestanding", wallType: "Single Wall", poleMaterial: "Aluminum" },
    tags: ["Semi-Freestanding", "Single Wall", "2-Person"],
  },
  "stratospire-2-by-tarptent": {
    brand: "Tarptent", name: "StratoSpire 2", itemType: "Backpacking Tent", weightGrams: 1244, // 43.9 oz
    attributes: { capacity: "2-Person", seasonRating: "3+ Season", tentType: "Trekking Pole Tent", wallType: "Double Wall", poleMaterial: "Trekking Poles" },
    tags: ["Trekking Pole Tent", "Double Wall", "2-Person"],
  },
  "notch-by-tarptent": {
    brand: "Tarptent", name: "Notch", itemType: "Backpacking Tent", weightGrams: 811, // 28.6 oz
    attributes: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Double Wall", poleMaterial: "Trekking Poles" },
    tags: ["Trekking Pole Tent", "Double Wall", "1-Person"],
  },
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
    const existing = await C.findOne({ brand: /^tarptent$/i, name: spec.name });
    if (existing) { console.log(`  SKIP (exists, precedence): ${spec.name}`); skipped++; continue; }
    const r = await fetch(`https://www.garagegrowngear.com/products/${handle}.json`, { headers: { "User-Agent": UA } });
    const p = (await r.json()).product;
    const imgs = (p.images || []).map((i) => i.src).slice(0, 10);
    const desc = cleanDesc(p.body_html);
    const { category, subcategory } = categoryForItemType(spec.itemType, spec.name);
    console.log(`  create: Tarptent | ${spec.name}  ${spec.weightGrams}g  imgs:${imgs.length}`);
    if (!COMMIT) continue;

    const doc = new C({ brand: spec.brand, name: spec.name, createdBy: ADMIN_ID });
    doc.itemType = spec.itemType; doc.category = category; doc.subcategory = subcategory;
    doc.isActive = true; doc.weightGrams = spec.weightGrams; doc.description = desc;
    doc.imageUrls = imgs; doc.tags = spec.tags; doc.attributes = spec.attributes;
    doc.$locals.lenientAttributes = true;
    await doc.save();
    await O.create({ network: "direct", region: "global", merchantId: "direct-ggg", merchantName: "Garage Grown Gear", productId: doc._id, deepLink: `https://www.garagegrowngear.com/products/${handle}`, priority: 0 });
    created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"} — created:${created} skipped:${skipped}`);
  await mongoose.disconnect();
})();
