/**
 * create-toaks.js — TOAKS (toaksoutdoor.com), Shopify (open products.json, 114 products),
 * pure backpacking titanium: pots, cups, cutlery, stoves, flasks, pans. REPLACE the manual
 * "Toaks" Amazon entries. Weights parsed from body_html (oz/g). Direct TOAKS offers.
 * NOTE: TOAKS stoves are alcohol/wood (not canister) — mapped to the only stove itemType;
 * a dedicated alcohol/wood-stove type is a review item.
 *
 *   node src/scripts/create-toaks.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.toaksoutdoor.com/products.json?limit=250";
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

const NAME_EXCLUDE = /grinder|storage bag|windscreen|\blid\b|stuff sack|\bsack\b|\bcase\b|carrying|holder|cozy|\bmesh\b|\bpouch\b|fireplace|\bbag\b|spare|replacement/i;
function resolveType(pt, name) {
  const t = pt || "", n = name;
  if (/stove/i.test(t) || /stove/i.test(n)) return "Backpacking Stove (Canister)";
  if (/cutlery/i.test(t) || /spork|spoon|\bfork\b|chopstick|utensil|\bknife\b/i.test(n)) return "Utensil";
  if (/flask/i.test(t) || /flask|bottle/i.test(n)) return "Water Bottle";
  if (/cup|doublewall|double wall/i.test(t) || /\bcup\b|\bmug\b/i.test(n)) return "Coffee Mug";
  if (/^pot|^pan|^plate|^bowl/i.test(t) || /\bpot\b|\bpan\b|cookset|cook set|kettle|\bplate\b|\bbowl\b/i.test(n)) return "Backpacking Pot";
  return null;
}
function weightG(html) {
  const t = strip(html);
  let m = t.match(/weight[^.]{0,18}?(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) return Math.round(parseFloat(m[1]));
  m = t.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
  if (m) return Math.round(parseFloat(m[1]) * 28.35);
  return null;
}
const gallery = (p) => (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 5);

(async () => {
  const products = ((await (await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } })).json()).products) || [];
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const old = await C.find({ brand: /^toaks$/i, isActive: true }).select("_id").lean();
  console.log(`existing TOAKS entries to archive: ${old.length}`);
  if (COMMIT && old.length) await C.collection.updateMany({ _id: { $in: old.map((o) => o._id) } }, { $set: { isActive: false } });

  let created = 0, skipped = 0; const typeCount = {};
  for (const p of products) {
    if (NAME_EXCLUDE.test(p.title) || /accessor/i.test(p.product_type || "")) { skipped++; continue; }
    const itemType = resolveType(p.product_type, p.title);
    if (!itemType) { skipped++; continue; }
    const name = strip(p.title);
    if (COMMIT && await C.findOne({ name, brand: "TOAKS", isActive: true }).select("_id").lean()) { skipped++; continue; }
    const { category, subcategory } = categoryForItemType(itemType, "");
    const wt = weightG(p.body_html);
    const images = gallery(p);
    typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    if (!COMMIT && created < 35) console.log(`${itemType.padEnd(26)} ${String(wt || "-").padStart(4)}g  ${name.slice(0, 44)}`);

    if (COMMIT) {
      if (!images.length) { skipped++; continue; }
      const doc = new C({
        name, brand: "TOAKS", itemType, ...(category ? { category, subcategory } : {}),
        description: strip(p.body_html).slice(0, 1000), imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(wt ? { weightGrams: wt } : {}), attributes: {},
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-toaks", merchantName: "TOAKS", productId: doc._id, deepLink: `https://www.toaksoutdoor.com/products/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\nby type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
