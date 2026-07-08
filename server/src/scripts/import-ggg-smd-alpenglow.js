/**
 * import-ggg-smd-alpenglow.js — 2026-07-02. Six Moon Designs TENTS (7 Tents & Shelters —
 * NOT the umbrellas/footprints/pack-liner/pods) + the one Alpenglow pump the user named.
 * Via GGG (collection endpoint). Real weights from descriptions (feed grams inflated:
 * Lunar Solo 907 vs 737; pump 21 vs real 8.5g). GGG direct offers.
 *
 *   node src/scripts/import-ggg-smd-alpenglow.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { execSync } = require("child_process");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const TENT = { seasonRating: "3-Season", tentType: "Trekking Pole Tent", poleMaterial: "Trekking Poles" };
const ITEMS = {
  "lunar-solo-by-six-moon-designs": { brand: "Six Moon Designs", name: "Lunar Solo", itemType: "Backpacking Tent", weightGrams: 737,
    attributes: { capacity: "1-Person", wallType: "Single Wall", ...TENT }, tags: ["Trekking Pole Tent", "Single Wall", "1-Person"] },
  "haven-two-person-ultralight-tent-by-six-moon-designs": { brand: "Six Moon Designs", name: "Haven Two Person Ultralight Tent", itemType: "Backpacking Tent", weightGrams: 964,
    attributes: { capacity: "2-Person", wallType: "Double Wall", ...TENT }, tags: ["Trekking Pole Tent", "Double Wall", "2-Person"] },
  "lunar-duo-explorer-by-six-moon-designs": { brand: "Six Moon Designs", name: "Lunar Duo Explorer (Silnylon)", itemType: "Backpacking Tent", weightGrams: 1276,
    attributes: { capacity: "2-Person", wallType: "Single Wall", ...TENT }, tags: ["Trekking Pole Tent", "Single Wall", "2-Person"] },
  "lunar-duo-outfitter-by-six-moon-designs": { brand: "Six Moon Designs", name: "Lunar Duo Outfitter (PU-Coated Polyester)", itemType: "Backpacking Tent", weightGrams: 1616,
    attributes: { capacity: "2-Person", wallType: "Single Wall", ...TENT }, tags: ["Trekking Pole Tent", "Single Wall", "2-Person"] },
  "skyscape-trekker-by-six-moon-designs": { brand: "Six Moon Designs", name: "Skyscape Trekker (Silicone coated Polyester)", itemType: "Backpacking Tent", weightGrams: 737,
    attributes: { capacity: "1-Person", wallType: "Single Wall", ...TENT }, tags: ["Trekking Pole Tent", "Single Wall", "1-Person"] },
  "skyscape-scout-by-six-moon-designs": { brand: "Six Moon Designs", name: "Skyscape Scout (PU coated Polyester)", itemType: "Backpacking Tent", weightGrams: 1134,
    attributes: { capacity: "1-Person", wallType: "Single Wall", ...TENT }, tags: ["Trekking Pole Tent", "Single Wall", "1-Person", "Budget"] },
  "gatewood-cape-by-six-moon-designs": { brand: "Six Moon Designs", name: "Gatewood Cape", itemType: "Tarp Shelter", weightGrams: 312,
    attributes: { shape: "Pyramid", material: "Silnylon" }, tags: ["Poncho-Tarp", "Trekking Pole", "1-Person"] },
  "alpenblow-micro-inflator-by-alpenglow-gear": { brand: "Alpenglow Gear", name: "Alpenblow Classic Micro Inflator", itemType: "Other", weightGrams: 9,
    cat: "Sleep System", sub: "Sleeping Pad Accessories", attributes: {}, tags: ["USB-C", "Sleeping Pad Pump"] },
};

// node fetch on GGG product .json intermittently returns empty (Cloudflare) — curl w/ retry.
function fetchProduct(handle) {
  for (let i = 0; i < 4; i++) {
    try {
      const out = execSync(`curl -s -A "${UA}" "https://www.garagegrowngear.com/products/${handle}.json"`, { maxBuffer: 20 * 1024 * 1024 }).toString();
      const j = JSON.parse(out);
      if (j.product) return j.product;
    } catch (e) { /* retry */ }
  }
  throw new Error("fetch failed after retries: " + handle);
}

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
    const existing = await C.findOne({ brand: new RegExp(`^${spec.brand}$`, "i"), name: spec.name });
    if (existing) { console.log(`  SKIP (exists): ${spec.brand} | ${spec.name}`); skipped++; continue; }
    const p = fetchProduct(handle);
    const imgs = (p.images || []).map((i) => i.src).slice(0, 10);
    const derived = categoryForItemType(spec.itemType, spec.name);
    const category = spec.cat || derived.category;
    const subcategory = spec.sub || derived.subcategory;
    console.log(`  create: ${spec.brand} | ${spec.name.padEnd(42)} [${spec.itemType}] ${spec.weightGrams}g ${category}/${subcategory} imgs:${imgs.length}`);
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
