/**
 * create-flextail.js — Flextail (flextail.com), Shopify (open products.json, 87 products).
 * User scope: Air Pumps, Power Banks, Sleeping Pad, Pillow, Headlamps + Lanterns,
 * Flashlights, Mosquito Repellers, Cozy Towel. EXCLUDE: SUP/tire pumps, vacuum storage
 * bags, OEM, accessories. Weights parsed from title/body_html (Flextail markets weight).
 * Air pumps + repellers have no dedicated itemType -> "Other". Direct Flextail offers.
 *
 *   node src/scripts/create-flextail.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.flextail.com/products.json?limit=250";
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

const EXCLUDE = /sup pump|tire pump|bike pump|balloon pump|vacuum|storage bag|\boem\b|accessor|slidecart|shipping|lampshade|appliance|gift card|clearance|spare|replacement|shower|per month|subscription/i;
function resolveType(name, pt) {
  const s = name + " " + (pt || "");
  if (/power bank|zero power/i.test(s)) return "Power Bank";
  if (/\bpump\b|air blast/i.test(name)) return "Other";              // pumps FIRST (many say "for sleeping pads")
  if (/repeller|repellent|mosquito/i.test(s)) return "Other";        // insect protection (before lantern; some are combo)
  if (/mattress|sleeping pad|tiny sleeping|air mat/i.test(s)) return "Inflatable Sleeping Pad";
  if (/pillow/i.test(s)) return "Pillow";
  if (/headlamp|helio/i.test(s)) return "Headlamp";
  if (/lantern/i.test(s)) return "Camp Lantern";
  if (/flashlight|torch/i.test(s)) return "Torch Light";
  if (/towel/i.test(s)) return "Travel Towel";
  return null;
}
function weightG(name, html) {
  const t = name + " " + strip(html);
  let m = t.match(/weight[:\s]+(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (!m) m = t.match(/\b(\d+(?:[.,]\d+)?)\s*g\b(?!\s*\/?\s*(?:m|sm))/i);
  const w = m ? Math.round(parseFloat(m[1].replace(",", "."))) : null;
  return w && w < 5000 ? w : null; // guard against mAh/other big numbers mis-read
}
const gallery = (p) => (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 5);
const cleanName = (t) => strip(t).replace(/\s*[-–—:].*$/, "").trim() || strip(t);

(async () => {
  const products = ((await (await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } })).json()).products) || [];
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0; const typeCount = {}; const seen = new Set();
  for (const p of products) {
    if (EXCLUDE.test(p.title) || EXCLUDE.test(p.product_type || "")) { skipped++; continue; }
    const itemType = resolveType(p.title, p.product_type);
    if (!itemType) { skipped++; continue; }
    const name = cleanName(p.title);
    if (seen.has(name.toLowerCase())) { skipped++; continue; }
    seen.add(name.toLowerCase());
    if (await C.findOne({ name, brand: "Flextail", isActive: true }).select("_id").lean()) { skipped++; continue; }

    const { category, subcategory } = categoryForItemType(itemType, "");
    const wt = weightG(p.title, p.body_html);
    const images = gallery(p);
    const description = strip(p.body_html).slice(0, 1000);
    typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    console.log(`${created + 1}. ${itemType.padEnd(22)} ${String(wt || "-").padStart(4)}g  ${name.slice(0, 42)}`);

    if (COMMIT) {
      if (!images.length) { skipped++; continue; }
      const doc = new C({
        name, brand: "Flextail", itemType, ...(category ? { category, subcategory } : {}),
        description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(wt ? { weightGrams: wt } : {}), attributes: {},
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-flextail", merchantName: "Flextail", productId: doc._id, deepLink: `https://www.flextail.com/products/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\nby type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
