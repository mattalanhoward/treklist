/**
 * create-snowpeak.js — Snow Peak (snowpeak.com), Shopify (open products.json, 856 products,
 * mostly US lifestyle apparel/furniture). REPLACE the 4 manual "Snowpeak" Amazon entries and
 * import the backpacking COOK/HYDRATION line: titanium mugs, cookware, cutlery, stoves,
 * flasks/bottles. Excludes apparel/tents/furniture/lanterns/parts/accessories. Weights parsed
 * from body_html (oz or g). Direct Snow Peak offers. Brand normalised to "Snow Peak".
 *
 *   node src/scripts/create-snowpeak.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.snowpeak.com/products.json?limit=250";
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

const TYPE_MAP = {
  "Cups & Mugs": "Coffee Mug", Cookware: "Backpacking Pot",
  Cutlery: "Utensil", Stoves: "Backpacking Stove (Canister)", "Bowls & Plates": "Backpacking Pot",
  "Flasks & Bottles": "Water Bottle", Coffee: "Backpacking Pot",
};
// exclude parts/accessories + Snow Peak's car-camping / lifestyle range
const NAME_EXCLUDE = /\bpart\b|\bcap\b|holder|griddle|charger|battery|accessor|double burner|lantern|stand|cover only|replacement|filter part|tent|firering|fire ring|skillet|grill|cast iron|dutch|\bigt\b|camp kitchen|essentials|station|\btable\b|bartender|serving set|firepit|takibi|jikaro|sandwich|breeze|hexa|land lock|amenity|fireplace|kit set|home ?& ?camp|shot glass|tea (cup|pot)|sayou|chopstick|flask in|shelter|apparel|growler|tramezzino|silicone lid|car camping|wapper|coffee grinder|coffee mill|\bmill\b|dining set|duo\b/i;
const MAX_G = 1500; // backpacking cook/hydration items are light; drops car-camping sets

function weightG(html, variant) {
  const t = strip(html);
  let m = t.match(/weight[^.]{0,20}?(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) return Math.round(parseFloat(m[1]));
  m = t.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
  if (m) return Math.round(parseFloat(m[1]) * 28.35);
  if (variant && variant.grams) return variant.grams; // Snow Peak grams tend to be real
  return null;
}
const gallery = (p) => (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 5);

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 4; page++) {
    let json; for (let t = 0; t < 3 && !json; t++) { try { const r = await fetch(`${FEED}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } }); if (r.ok) json = await r.json(); } catch (e) {} }
    if (!json || !json.products || !json.products.length) break;
    out.push(...json.products);
  }
  return out;
}

(async () => {
  const products = await fetchAll();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  // 1. archive the manual Amazon "Snowpeak"/"Snow Peak" entries
  const old = await C.find({ brand: /^snow\s?peak$/i, isActive: true }).select("_id name").lean();
  console.log(`existing Snow Peak entries to archive: ${old.length}`);
  if (COMMIT && old.length) await C.collection.updateMany({ _id: { $in: old.map((o) => o._id) } }, { $set: { isActive: false } });

  let created = 0, skipped = 0; const typeCount = {};
  for (const p of products) {
    const itemType = TYPE_MAP[p.product_type];
    if (!itemType) { skipped++; continue; }
    if (NAME_EXCLUDE.test(p.title)) { skipped++; continue; }
    const name = strip(p.title);
    if (COMMIT && await C.findOne({ name, brand: "Snow Peak", isActive: true }).select("_id").lean()) { skipped++; continue; }
    const { category, subcategory } = categoryForItemType(itemType, "");
    const wt = weightG(p.body_html, (p.variants || [])[0]);
    if (wt && wt > MAX_G) { skipped++; continue; } // car-camping/lifestyle weight
    const images = gallery(p);
    const description = strip(p.body_html).slice(0, 1000);
    typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    if (!COMMIT && created < 40) console.log(`${itemType.padEnd(26)} ${String(wt || "-").padStart(4)}g  ${name.slice(0, 40)}`);

    if (COMMIT) {
      if (!images.length) { skipped++; continue; }
      const doc = new C({
        name, brand: "Snow Peak", itemType, ...(category ? { category, subcategory } : {}),
        description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(wt ? { weightGrams: wt } : {}), attributes: {},
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-snowpeak", merchantName: "Snow Peak", productId: doc._id, deepLink: `https://www.snowpeak.com/products/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\nby type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
