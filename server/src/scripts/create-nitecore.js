/**
 * create-nitecore.js — Nitecore (nitecorestore.com, US distributor, Shopify open feed).
 * User scope: HEADLAMPS + POWER BANKS ONLY (the site is mostly flashlights/batteries).
 * Weights parsed from body_html (g/oz). Direct offers. Adds to the 4 existing Nitecore
 * items (dedupe by name).
 *
 *   node src/scripts/create-nitecore.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.nitecorestore.com/products.json?limit=250";
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

function resolveType(pt, name) {
  const s = (pt || "") + " " + name;
  if (/power ?bank/i.test(s)) return "Power Bank";
  if (/headlamp|head lamp|head torch/i.test(s)) return "Headlamp";
  return null;
}
function weightG(html) {
  const t = strip(html);
  let m = t.match(/weight[^.]{0,20}?(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) return Math.round(parseFloat(m[1]));
  m = t.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
  if (m) return Math.round(parseFloat(m[1]) * 28.35);
  return null;
}
const gallery = (p) => (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 5);
async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 6; page++) {
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

  let created = 0, skipped = 0; const typeCount = {};
  for (const p of products) {
    const itemType = resolveType(p.product_type, p.title);
    if (!itemType) { skipped++; continue; }
    const name = strip(p.title).replace(/\s*[-–]\s*nitecore.*$/i, "").trim();
    if (await C.findOne({ name, brand: "Nitecore", isActive: true }).select("_id").lean()) { skipped++; continue; }
    const { category, subcategory } = categoryForItemType(itemType, "");
    const wt = weightG(p.body_html);
    const images = gallery(p);
    typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    if (!COMMIT && created < 40) console.log(`${itemType.padEnd(12)} ${String(wt || "-").padStart(4)}g  ${name.slice(0, 44)}`);

    if (COMMIT) {
      if (!images.length) { skipped++; continue; }
      const doc = new C({
        name, brand: "Nitecore", itemType, ...(category ? { category, subcategory } : {}),
        description: strip(p.body_html).slice(0, 1000), imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(wt ? { weightGrams: wt } : {}), attributes: {},
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-nitecore", merchantName: "Nitecore Store", productId: doc._id, deepLink: `https://www.nitecorestore.com/products/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\nby type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
