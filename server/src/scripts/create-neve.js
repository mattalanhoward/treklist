/**
 * create-neve.js — Neve Gear (nevegear.com.au), small Australian cottage UL brand on
 * Shopify (open products.json, ~12 products): quilts, sleeping bags, a down hoody, a pack,
 * dry bags, a foam pad. No product_type → classify by name. Weights parsed from body_html.
 * Temp is a Shopify variant OPTION here (not separate products); for a brand this small we
 * import one item per product (temp from the name where stated) and flag temp-splitting for
 * the deep review. Direct Neve Gear offers.
 *
 *   node src/scripts/create-neve.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://nevegear.com.au/products.json?limit=250";
const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

function resolveType(n) {
  if (/gift card/i.test(n)) return null;
  if (/sleeping bag/i.test(n)) return "Sleeping Bag";
  if (/quilt/i.test(n)) return "Quilt";
  if (/hoody|hoodie|down jacket|puffy|insulat/i.test(n)) return "Insulated Jacket";
  if (/foam pad|foam mat/i.test(n)) return "Foam Sleeping Pad";
  if (/sleeping pad|mat\b|mattress/i.test(n)) return "Inflatable Sleeping Pad";
  if (/dry bag|stuff sack|storage bag/i.test(n)) return "Dry Bag / Stuff Sack";
  if (/pad strap|strap set/i.test(n)) return "Other";
  if (/\d+\s?l\b|backpack|\bpack\b|wallaroo/i.test(n)) return "Backpack";
  return "Other";
}
function weightG(html) {
  const t = strip(html);
  let m = t.match(/weight[:\s]+(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (!m) m = t.match(/\b(\d+(?:[.,]\d+)?)\s*g\b(?!\s*\/?\s*(?:m|sm))/i);
  return m ? Math.round(parseFloat(m[1].replace(",", "."))) : null;
}

(async () => {
  const products = ((await (await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0" } })).json()).products) || [];
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0;
  for (const p of products) {
    const name = strip(p.title);
    const itemType = resolveType(name);
    if (!itemType) { skipped++; continue; }
    if (await C.findOne({ name, brand: "Neve Gear", isActive: true }).select("_id").lean()) { skipped++; continue; }
    const { category, subcategory } = categoryForItemType(itemType, "");
    const wt = weightG(p.body_html);
    const img = (p.images || [])[0] && p.images[0].src;
    let description = strip(p.body_html).slice(0, 1200);
    const attributes = {};
    const tc = (name.match(/(-?\d+)\s*°?\s*c\b/i) || [])[1];
    if ((itemType === "Sleeping Bag" || itemType === "Quilt") && tc != null) attributes.tempRatingC = parseInt(tc);
    // temp is a variant option on Neve bags/quilts -> flag for review
    const tempOpt = (p.options || []).some((o) => /comfort|temperature|rating/i.test(o.name));
    if (tempOpt) description += "\n\nAvailable in multiple temperature ratings — see product page. (Split by temperature in review.)";

    console.log(`${created + 1}. ${itemType.padEnd(22)} ${String(wt || "-").padStart(4)}g ${tempOpt ? "T" : " "} ${name.slice(0, 40)}`);
    if (COMMIT) {
      if (!img) { skipped++; continue; }
      const doc = new C({
        name, brand: "Neve Gear", itemType, ...(category ? { category, subcategory } : {}),
        description, imageUrls: [img], createdBy: ADMIN_ID, isActive: true,
        ...(wt ? { weightGrams: wt } : {}), attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log("  !! " + e.message); skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-nevegear", merchantName: "Neve Gear", productId: doc._id, deepLink: `https://nevegear.com.au/products/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
