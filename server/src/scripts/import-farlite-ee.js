/**
 * import-farlite-ee.js — Enlightened Equipment via Farlite (WooCommerce back-door; EE's
 * own site has no open feed). User wants the BAGS (quilts) — Revelation/Enigma down +
 * Revelation APEX synthetic (20/30/40F) + Cloud 9 pillow. Skip apparel (Torrid Jacket,
 * Rain Wrap) + Pad Straps accessory. Real weights (Woo field) + temp from name (°F).
 * Farlite direct offers (prefer /en/ permalink; Farlite lists EN+FI twice).
 *
 *   node src/scripts/import-farlite-ee.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const f2c = (f) => Math.round(((f - 32) * 5) / 9);

// Revelation = zippered footbox; Enigma = sewn-closed footbox; both use pad straps.
const APEX = (f, g) => ({ name: `Revelation APEX ${f}F`, re: new RegExp(`revelation apex ${f}f`, "i"), itemType: "Quilt", g,
  attributes: { insulationType: "Synthetic", syntheticInsulationType: "ClimaShield APEX", tempRatingF: f, tempRatingC: f2c(f), footboxType: "Zippered", attachmentSystem: "Pad Straps" }, tags: ["Synthetic", "ClimaShield APEX", "Made in USA"] });
const DOWN = (model, f, g, foot) => ({ name: `${model} ${f}F`, re: new RegExp(`${model} ${f}f`, "i"), itemType: "Quilt", g,
  attributes: { insulationType: "Down", fillPower: 850, tempRatingF: f, tempRatingC: f2c(f), footboxType: foot, attachmentSystem: "Pad Straps" }, tags: ["Down", "850 FP", "Made in USA"] });

const ITEMS = [
  APEX(20, 854), APEX(30, 675), APEX(40, 532),
  DOWN("Revelation", 20, 638, "Zippered"),
  DOWN("Enigma", 20, 601, "Sewn Closed"),
  DOWN("Enigma", 30, 510, "Sewn Closed"),
  { name: "Cloud 9 UL Pillow", re: /cloud 9 ul pillow/i, itemType: "Pillow", g: 101, attributes: {}, tags: ["Ultralight", "Made in USA"] },
];

function cleanDesc(html) {
  let t = (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&deg;/g, "°").replace(/&#8217;|&rsquo;/g, "'").replace(/&#8211;|&#8212;/g, "-").replace(/\s+/g, " ").trim();
  return t.slice(0, 600);
}

(async () => {
  const r = await fetch("https://farlite.fi/wp-json/wc/store/v1/products?per_page=100&search=enlightened", { headers: { "User-Agent": UA } });
  const feed = await r.json();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0;

  for (const spec of ITEMS) {
    const existing = await C.findOne({ brand: /^enlightened equipment$/i, name: spec.name });
    if (existing) { console.log(`  SKIP (exists): ${spec.name}`); skipped++; continue; }
    const matches = feed.filter((p) => spec.re.test(p.name));
    const p = matches.find((x) => /\/en\//.test(x.permalink)) || matches[0];
    if (!p) { console.log(`  ! not found: ${spec.name}`); continue; }
    const imgs = (p.images || []).map((i) => i.src).slice(0, 8);
    const { category, subcategory } = categoryForItemType(spec.itemType, spec.name);
    console.log(`  create: ${spec.name.padEnd(22)} [${spec.itemType}] ${spec.g}g imgs:${imgs.length}`);
    if (!COMMIT) continue;
    const doc = new C({ brand: "Enlightened Equipment", name: spec.name, createdBy: ADMIN_ID });
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
