/**
 * create-gramxpert.js — GramXpert (gramxpert.eu), EU cottage UL brand on WooCommerce.
 * Woo Store API is open (`/wp-json/wc/store/v1/products`), but the `weight` field is
 * EMPTY on every product (same as Bonfus) — real weights are labeled "Weight: NNg" in the
 * HTML `description`, parsed here. Excludes service/shipping/customization SKUs. Types via
 * inferItemType + category fallback; unmappable accessories go in "Other" (reclassify later).
 * Direct GramXpert offers (no affiliate program). Colour/size variations collapsed for now.
 *
 *   node src/scripts/create-gramxpert.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { inferItemType, categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.gramxpert.eu/wp-json/wc/store/v1/products?per_page=100";

const EXCLUDE = /dhl|shipping|customization|customisation|\bcharge\b|full zipper|removable pocket|dog quilt|express fee/i;
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
const CAT_TYPE = { Tarps: "Tarp Shelter", Quilts: "Quilt", Bivys: "Backpacking Tent", Backpacks: "Backpack" };

function resolveType(p) {
  const n = p.name;
  // accessories that would otherwise mis-match a shelter/stake rule
  if (/tie ?out|tieout|peg bag/i.test(n)) return /peg bag/i.test(n) ? "Dry Bag / Stuff Sack" : "Other";
  // strong name rules first
  if (/tarp/i.test(n)) return "Tarp Shelter";
  if (/quilt/i.test(n)) return "Quilt";
  if (/bivy|bivvy/i.test(n)) return "Backpacking Tent";
  if (/groundsheet|ground sheet|polycro/i.test(n)) return "Ground Sheet";
  if (/tent peg|stake/i.test(n)) return "Tent Stakes";
  if (/sleeping bag liner|liner/i.test(n)) return "Sleeping Bag Liner";
  if (/stuff\s?sack|dry bag|ditty|stuffsack|storage bag|food bag|zip pouch|rolltop|pouch/i.test(n)) return "Dry Bag / Stuff Sack";
  if (/balaclava|beanie|hat/i.test(n)) return "Hat/Headwear";
  if (/backpack cover|pack cover/i.test(n)) return "Pack Liner";
  if (/hip belt pocket|fanny pack|hip pack/i.test(n)) return "Hip Pack";
  if (/wind pants|rain pant/i.test(n)) return "Rain Pants";
  if (/shorts/i.test(n)) return "Hiking Shorts";
  if (/\bpants\b/i.test(n)) return "Hiking Pants";
  if (/backpack/i.test(n)) return "Backpack";
  const inf = inferItemType(n);
  if (inf && inf !== "Other") return inf;
  const cat = (p.categories || []).map((c) => c.name).find((c) => CAT_TYPE[c]);
  return (cat && CAT_TYPE[cat]) || "Other";
}
function weightG(desc) {
  const t = strip(desc);
  // labeled weight first
  let m = t.match(/weight[:\s]+(\d+(?:[.,]\d+)?)\s*g\b/i);
  // else first standalone gram figure that isn't a fabric areal weight (g/m², gsm)
  if (!m) m = t.match(/\b(\d+(?:[.,]\d+)?)\s*g\b(?!\s*\/?\s*(?:m|sm|smq|\/m))/i);
  return m ? Math.round(parseFloat(m[1].replace(",", "."))) : null;
}

async function fetchAll() {
  const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } });
  return res.json();
}

(async () => {
  const products = (await fetchAll()).filter((p) => !EXCLUDE.test(p.name) && p.is_purchasable !== false);
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0; const typeCount = {}; const seen = new Set();
  for (const p of products) {
    const name = strip(p.name);
    if (seen.has(name.toLowerCase())) { skipped++; continue; } // e.g. two "Custom backpack"
    seen.add(name.toLowerCase());
    if (await C.findOne({ name, brand: "GramXpert", isActive: true }).select("_id").lean()) { skipped++; continue; }
    const itemType = resolveType(p);
    const { category, subcategory } = categoryForItemType(itemType, "");
    const wt = weightG(p.description);
    const img = (p.images || [])[0] && p.images[0].src;
    const desc = (strip(p.short_description) || strip(p.description)).slice(0, 1200);
    const price = p.prices && p.prices.price ? (parseInt(p.prices.price) / 100).toFixed(2) : null;
    const manyVars = (p.variations || []).length > 1;

    typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    console.log(`${created + 1}. ${itemType.padEnd(22)} ${String(wt || "-").padStart(4)}g ${manyVars ? "V" : " "} ${name.slice(0, 40)}`);

    if (COMMIT) {
      if (!img) { console.log(`   !! no image — skip`); skipped++; continue; }
      const doc = new C({
        name, brand: "GramXpert", itemType,
        ...(category ? { category, subcategory } : {}),
        description: desc + (manyVars ? "\n\nMultiple size/fabric options available." : ""),
        imageUrls: [img], createdBy: ADMIN_ID, isActive: true,
        ...(wt ? { weightGrams: wt } : {}),
        attributes: {},
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-gramxpert", merchantName: "GramXpert", productId: doc._id, deepLink: p.permalink, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\nby type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
