/**
 * create-smartwool.js — Smartwool (smartwool.com/en-us), VF Corp merino brand on Shopify
 * (open products.json). 529 products, ~half socks. We keep the TECHNICAL/outdoor line and
 * drop pure lifestyle (sweaters, polos, skirts, cable/everyday socks). Apparel garment
 * weights aren't in Shopify feeds → imported weightless (standard for apparel), with a Size
 * variant axis, colour collapsed. Direct Smartwool offers (re-point if VF affiliate lands).
 *
 *   node src/scripts/create-smartwool.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.smartwool.com/en-us/products.json?limit=250";

const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
// technical sock lines to KEEP (drop everyday/lifestyle)
const SOCK_KEEP = /hike|trek|run|trail|mountaineer|\bski\b|snowboard|performance|athletic|outdoor|cushion|compression|liner|bike|cycl/i;
const SOCK_DROP = /everyday|cozy|lounge|cable|no\s?show|lifestyle|dress|barsleeve|sleeve/i;
// lifestyle product_types to EXCLUDE entirely
const TYPE_DROP = /^(Sweaters|Polos|Crew Neck|Skirts|Bag|Gift Card|Tanks)$/i;

function resolveType(pt, name) {
  const t = pt || "";
  if (/sock/i.test(t)) return "Hiking Socks";
  if (/base layer bottom|tights|legging/i.test(t)) return "Base Layer Bottom";
  if (/base layer|1\/4 zip|1\/2 zip/i.test(t)) return "Base Layer Top";
  if (/boxer|brief|underwear/i.test(t)) return "Underwear";
  if (/bra/i.test(t)) return "Bra";
  if (/beanie|hat|headband/i.test(t)) return "Hat/Headwear";
  if (/neck gaiter|balaclava/i.test(t)) return "Neck Gaiter";
  if (/glove|mitten/i.test(t)) return "Gloves (Insulated)";
  if (/short sleeve|long sleeve|\btops?\b|polo|tank/i.test(t)) return "Hiking Shirt";
  if (/short/i.test(t)) return "Hiking Shorts";
  if (/pant/i.test(t)) return "Hiking Pants";
  if (/vest|jacket/i.test(t)) return "Insulated Jacket";
  if (/hoodie|pullover/i.test(t)) return "Fleece Jacket";
  return null;
}
function genderOf(s) {
  if (/women|women's|womens|\bwmn\b/i.test(s)) return "Womens";
  if (/\bmen'?s\b|\bmens\b/i.test(s)) return "Mens";
  return "Unisex";
}
function cleanName(title) {
  return title.replace(/\s*[-–]\s*(men'?s|women'?s|unisex)\b.*$/i, "").replace(/\s+/g, " ").trim();
}
function gallery(p) { return (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 6); }
// Smartwool sells the same sock in many prints as separate products. Collapse by the
// structural model (gender + line + cushion + cut) so we keep ~one per real sock model,
// not one per colorway. (Representative name kept as-is; colorway-name cleanup is a
// deep-review task.)
function sockKey(gender, title) {
  const t = title.toLowerCase();
  const line = (t.match(/hike|run|trek|ski|mountaineer|snowboard|performance|athletic|bike|cycl|classic|everyday/) || [""])[0];
  const cushion = (t.match(/zero cushion|light cushion|full cushion|targeted cushion|medium cushion|extra cushion/) || [""])[0];
  const cut = (t.match(/no.?show|micro|mini|ankle|crew|knee|otc|over the calf|maxi|liner|\bmid\b|\blow\b/) || [""])[0];
  return [gender, line, cushion, cut].join("|");
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
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

  let created = 0, skipped = 0; const typeCount = {}; const seenSocks = new Set();
  for (const p of products) {
    const pt = p.product_type || "";
    if (TYPE_DROP.test(pt)) { skipped++; continue; }
    const title = p.title;
    if (/sock/i.test(pt)) {
      if (!SOCK_KEEP.test(title) || SOCK_DROP.test(title)) { skipped++; continue; }
      const k = sockKey(genderOf(title + " " + (p.tags || []).join(" ")), title);
      if (seenSocks.has(k)) { skipped++; continue; } // collapse colorways of the same model
      seenSocks.add(k);
    }
    const itemType = resolveType(pt, title);
    if (!itemType) { skipped++; continue; }

    const name = cleanName(title);
    const brand = "Smartwool";
    if (await C.findOne({ name, brand, isActive: true }).select("_id").lean()) { skipped++; continue; }

    const gender = genderOf(title + " " + (p.tags || []).join(" "));
    const { category, subcategory } = categoryForItemType(itemType, gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : "");
    const images = gallery(p);
    const description = strip(p.body_html).slice(0, 1200);
    const sizeOpt = (p.options || []).find((o) => /size/i.test(o.name));
    let variantAxes, variants, defaultVariantKey;
    if (sizeOpt && sizeOpt.values.length > 1) {
      variantAxes = [{ name: "Size", values: sizeOpt.values }];
      variants = sizeOpt.values.map((s) => ({ key: s, options: { Size: s } }));
      defaultVariantKey = sizeOpt.values[0];
    }

    typeCount[itemType] = (typeCount[itemType] || 0) + 1;
    if (!COMMIT && created < 30) console.log(`${itemType.padEnd(18)} ${gender.padEnd(7)} ${variantAxes ? "Sz" : "  "} ${name.slice(0, 46)}`);

    if (COMMIT) {
      if (!images.length) { skipped++; continue; }
      const doc = new C({
        name, brand, itemType,
        ...(category ? { category, subcategory } : {}),
        description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
        attributes: { gender, material: "Merino Wool" },
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-smartwool", merchantName: "Smartwool", productId: doc._id, deepLink: `https://www.smartwool.com/en-us/p/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`\nby type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
