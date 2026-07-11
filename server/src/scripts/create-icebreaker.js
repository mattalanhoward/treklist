/**
 * create-icebreaker.js — Icebreaker (icebreaker.com/en-us), merino brand on Shopify (open
 * products.json, 750 products). Colour + Size are variant OPTIONS within each product (so
 * little colorway proliferation, unlike Smartwool). Keep the technical/outdoor line + merino
 * apparel, drop lifestyle (dresses/skirts/kids/collabs). Apparel weightless + Size axis,
 * colour collapsed. Direct Icebreaker offers.
 *
 *   node src/scripts/create-icebreaker.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://www.icebreaker.com/en-us/products.json?limit=250";

const strip = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
const SOCK_KEEP = /hike|trek|run|trail|mountaineer|\bski\b|snowboard|performance|athletic|outdoor|cushion|compression|liner|bike|cycl|lifestyle light|merino/i;
const SOCK_DROP = /everyday|cozy|lounge|cable|no\s?show|dress/i;
const TYPE_DROP = /dress|skirt|kids|gift card|timberland/i;

// Scoped to Icebreaker's backpacking-relevant merino CORE (next-to-skin + accessories).
// Lifestyle tops/tees/pants/shorts/sweaters/jackets/dresses are intentionally dropped
// (Icebreaker is now largely athleisure) — return null.
function resolveType(pt, name) {
  const t = pt || "", n = name || "";
  if (/sock/i.test(t)) return "Hiking Socks";
  if (/base layer bottom/i.test(t)) return "Base Layer Bottom";
  if (/base layer/i.test(t)) return /bottom|legging|tight|boxer|brief/i.test(n) ? "Base Layer Bottom" : "Base Layer Top";
  if (/bra/i.test(t)) return /\bbra\b/i.test(n) ? "Bra" : "Underwear";
  if (/underwear/i.test(t)) return /\bbra\b/i.test(n) ? "Bra" : "Underwear";
  if (/neck gaiter|balaclava/i.test(t)) return "Neck Gaiter";
  if (/neckwear/i.test(t)) return /gaiter|balaclava|tube|scarf|neck warmer/i.test(n) ? "Neck Gaiter" : "Hat/Headwear";
  if (/hat|beanie|headband/i.test(t)) return "Hat/Headwear";
  if (/glove|mitten/i.test(t)) return "Gloves (Insulated)";
  // product_type "Accessories" carries in-scope hats/gloves/neckwear (2026-07-10 review:
  // this hole dropped the glove liners/beanies/chute) — classify those by NAME
  if (/accessor/i.test(t)) {
    if (/glove|mitten/i.test(n)) return "Gloves (Insulated)";
    if (/beanie|\bhat\b|headband/i.test(n)) return "Hat/Headwear";
    if (/chute|gaiter|balaclava|neck warmer|neck tube/i.test(n)) return "Neck Gaiter";
    return null; // arm sleeves etc. stay out
  }
  // 2026-07-11 user decision: re-admit the 5 genuinely TECHNICAL hike lines that the
  // athleisure cut removed (Smartwool's equivalents were kept)
  if (/tech lite/i.test(n) && /\btee\b|t-shirt/i.test(n)) return "Hiking Shirt";
  if (/quantum/i.test(n) && /zip|hood/i.test(n)) return "Fleece Jacket";
  if (/realfleece™? descender/i.test(n) && /hoody|hoodie|zip|jacket|vest/i.test(n)) return "Fleece Jacket";
  if (/200 oasis/i.test(n) && /half zip/i.test(n)) return "Base Layer Top";
  if (/elevation stretch pants/i.test(n)) return "Hiking Pants";
  return null; // drop remaining lifestyle tops/tees/pants/shorts/sweaters/dresses
}
function genderOf(s) {
  if (/women|women's|womens/i.test(s)) return "Womens";
  if (/\bmen'?s\b|\bmens\b/i.test(s)) return "Mens";
  return "Unisex";
}
const cleanName = (t) => t.replace(/\s*[-–]\s*(men'?s|women'?s|unisex)\b.*$/i, "").replace(/\s+/g, " ").trim();
const gallery = (p) => (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 6);
function sockKey(g, title) {
  const t = title.toLowerCase();
  const line = (t.match(/hike|run|trek|ski|mountaineer|snowboard|performance|athletic|bike|cycl|lifestyle/) || [""])[0];
  const cushion = (t.match(/zero|light|medium|heavy|full|ultralight|no cushion/) || [""])[0];
  const cut = (t.match(/no.?show|micro|mini|ankle|crew|knee|otc|over the calf|maxi|liner|\bmid\b|\blow\b|quarter/) || [""])[0];
  return [g, line, cushion, cut].join("|");
}
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

  let created = 0, skipped = 0; const typeCount = {}; const seenSocks = new Set();
  for (const p of products) {
    const pt = p.product_type || "";
    if (TYPE_DROP.test(pt) || TYPE_DROP.test(p.title)) { skipped++; continue; }
    const title = p.title;
    if (/sock/i.test(pt)) {
      if (!SOCK_KEEP.test(title) || SOCK_DROP.test(title)) { skipped++; continue; }
      const k = sockKey(genderOf(title), title);
      if (seenSocks.has(k)) { skipped++; continue; }
      seenSocks.add(k);
    }
    const itemType = resolveType(pt, title);
    if (!itemType) { skipped++; continue; }
    const name = cleanName(title);
    if (await C.findOne({ name, brand: "Icebreaker", isActive: true }).select("_id").lean()) { skipped++; continue; }

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

    if (COMMIT) {
      if (!images.length) { skipped++; continue; }
      const doc = new C({
        name, brand: "Icebreaker", itemType,
        ...(category ? { category, subcategory } : {}),
        description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
        attributes: { gender, material: "Merino Wool" },
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { skipped++; continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-icebreaker", merchantName: "Icebreaker", productId: doc._id, deepLink: `https://www.icebreaker.com/en-us/p/${p.handle}`, priority: 0 });
      created++;
    } else created++;
  }
  console.log(`by type:`, JSON.stringify(typeCount));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
})();
