/**
 * create-mont.js — Mont Adventure Equipment (mont.equipment), an Australian full-line
 * brand on Shopify with an OPEN products.json feed (185 products, no bot-wall). Single
 * brand (the numeric "vendors" are internal codes). Typed from Mont's own structured
 * `product_type` taxonomy ("Camp : Sleeping : Sleeping Bag : Down", "Clothing :
 * Shellwear : Jacket : Mens", …), which is far more reliable than name-inference.
 *
 * Scope (user, 2026-08-06): FULL technical line — gear + all technical apparel, gendered.
 * SKIP/exclude: the Defence & Commercial (hi-vis) line, shelter accessories (footprints/
 * pegs/poles/guy ropes), inner tents (components), sleeping-bag storage sacks, gift cards.
 *
 * Variants (locked REI standard): temperature is already in bag NAMES (identity) → each
 * bag is its own item; the non-colour option (Size — Mont bundles gender/zip/length into
 * its size labels, e.g. "Standard Left Zip") is the variant axis with per-size feed
 * weights; COLOUR is dropped. Apparel weights are flat across sizes (reference size) →
 * item weight + a flat-weight disclosure. Shopify selector page → ONE item-level offer.
 *
 *   node src/scripts/create-mont.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

// product_type → itemType. null = skip. Order matters (first match wins).
function typeOf(pt, title) {
  const t = (pt || "").toLowerCase().replace(/\s+/g, " "); // normalize non-breaking spaces in the feed taxonomy
  const name = (title || "").toLowerCase();
  if (!t || /gift card/.test(name)) return null;
  if (/defence/.test(t)) return null;
  if (/shelter : accessories/.test(t) || /footprint/.test(name)) return null;
  if (/tent/.test(t) && /inner/.test(t)) return null;
  if (/sleeping bag : storage/.test(t)) return null;
  if (/sleeping bag : liner/.test(t)) return "Sleeping Bag Liner";
  if (/sleeping bag/.test(t)) return "Sleeping Bag";
  if (/sleeping : mat/.test(t)) return /sit/.test(name) ? "Sit Pad" : "Foam Sleeping Pad";
  if (/shelter : tent/.test(t)) return "Backpacking Tent";
  if (/shelter : tarp/.test(t)) return "Tarp Shelter";
  if (/shelter : bivvy/.test(t)) return "Bivy Sack";
  if (/bathroom : towels/.test(t)) return "Travel Towel";
  if (/water : storage : bottle/.test(t)) return "Water Bottle";
  if (/pack : accessories : compression/.test(t)) return "Dry Bag / Stuff Sack";
  if (/hike : pack/.test(t)) return "Backpack";
  if (/(down|synthetic) : jacket/.test(t) || /(down|synthetic) : vest/.test(t)) return "Insulated Jacket";
  if (/down : pants/.test(t)) return "Other";
  if (/shellwear : jacket/.test(t)) return "Rain Jacket";
  if (/shellwear : pants/.test(t)) return "Rain Pants";
  if (/softshell/.test(t)) return "Softshell Jacket";
  if (/fleece : pants/.test(t)) return "Other";
  if (/fleece/.test(t)) return "Fleece Jacket";
  if (/base layer : top/.test(t)) return "Base Layer Top";
  if (/base layer : pants/.test(t)) return "Base Layer Bottom";
  if (/base layer : underwear/.test(t)) return "Underwear";
  if (/: shirt :/.test(t) || /: tee :/.test(t)) return "Hiking Shirt";
  if (/bottoms : pants/.test(t)) return "Hiking Pants";
  if (/bottoms : short/.test(t)) return "Hiking Shorts";
  if (/bottoms : zipoff/.test(t)) return "Convertible Pants";
  if (/headwear : neckwarmer/.test(t)) return "Neck Gaiter";
  if (/headwear/.test(t)) return "Hat/Headwear";
  return null; // unmapped → skip (logged)
}

const genderOf = (pt) => (/womens/i.test(pt) ? "Womens" : /mens/i.test(pt) ? "Mens" : /unisex/i.test(pt) ? "Unisex" : null);
const capOf = (pt) => { const m = (pt || "").match(/(\d)\s*person/i); return m ? `${m[1]}-Person` : null; };
const volOf = (name) => { const m = (name || "").match(/(\d{2,3})\s*L\b/); return m ? Number(m[1]) : null; };
const tempOf = (name) => { const m = (name || "").match(/(-?\d+)\s*(?:to\s*-?\d+\s*)?°?\s*C\b/i); return m ? Number(m[1]) : null; };

function buildAttrs(itemType, pt, name) {
  const a = {};
  const g = genderOf(pt);
  if (g) a.gender = g;
  if (itemType === "Sleeping Bag") { a.insulationType = /synthetic/i.test(pt) ? "Synthetic" : "Down"; const tc = tempOf(name); if (tc != null) a.tempRatingC = tc; }
  if (itemType === "Insulated Jacket") a.insulationType = /synthetic/i.test(pt) ? "Synthetic" : "Down";
  if (itemType === "Backpacking Tent") { const c = capOf(pt); if (c) a.capacity = c; a.seasonRating = "3-Season"; }
  if (itemType === "Backpack") { const v = volOf(name); if (v) a.volumeLiters = v; }
  return a;
}

async function fetchProducts() {
  let all = [], page = 1;
  while (page <= 10) {
    const r = await fetch(`https://mont.equipment/products.json?limit=250&page=${page}`, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error("feed http " + r.status);
    const ps = (await r.json()).products || [];
    all = all.concat(ps);
    if (ps.length < 250) break; page++;
  }
  return all;
}

(async () => {
  const products = await fetchProducts();
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0, skipped = 0; const byType = {};
  for (const p of products) {
    const itemType = typeOf(p.product_type, p.title);
    if (!itemType) { skipped++; continue; }

    // size axis = the non-colour/title option; collapse colour, one weight per size
    const sizeOpt = (p.options || []).find((o) => !/colou?r|title/i.test(o.name));
    const posn = sizeOpt ? sizeOpt.position : null;
    const key = (v) => (posn ? (v[`option${posn}`] || v.title) : v.title);
    const seen = new Map();
    for (const v of p.variants) { const k = key(v); if (!seen.has(k)) seen.set(k, v.grams || 0); }
    const sizes = sizeOpt ? [...seen.keys()] : null;
    const gramsList = [...seen.values()].filter((x) => x > 0);
    const varies = new Set(gramsList).size > 1;

    let variantAxes, variants, defaultVariantKey, weightGrams;
    if (sizes && sizes.length > 1) {
      variantAxes = [{ name: sizeOpt.name, values: sizes }];
      variants = sizes.map((s) => ({ key: s, options: { [sizeOpt.name]: s }, ...(varies && seen.get(s) > 0 ? { weightGrams: seen.get(s) } : {}) }));
      defaultVariantKey = sizes[0];
      weightGrams = varies ? (seen.get(sizes[0]) || undefined) : (gramsList[0] || undefined);
    } else {
      weightGrams = gramsList[0] || undefined;
    }

    const attributes = buildAttrs(itemType, p.product_type, p.title);
    const { category, subcategory } = categoryForItemType(itemType, p.title);
    const images = (p.images || []).map((i) => i.src).slice(0, 6);
    const deepLink = `https://mont.equipment/products/${p.handle}`;
    const flatApparelNote = sizes && !varies && weightGrams ? " Listed weight is Mont's reference-size figure; it does not vary by the size selected here." : "";
    const desc = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400) + flatApparelNote;

    byType[itemType] = (byType[itemType] || 0) + 1;
    console.log(`${itemType.padEnd(20)} ${p.title.slice(0, 46).padEnd(46)} ${weightGrams ?? "?"}g ${sizes ? "[" + sizes.length + "sz" + (varies ? "*" : "") + "]" : ""}`);

    if (COMMIT) {
      if (await C.findOne({ name: p.title, brand: "Mont" })) { console.log(`  exists — skip`); continue; }
      if (!images.length) { console.log(`  !! no images — skip ${p.title}`); continue; }
      const doc = new C({
        name: p.title, brand: "Mont", itemType, category, subcategory,
        description: desc, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(weightGrams != null ? { weightGrams } : {}), attributes,
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`  !! ${p.title}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-mont", merchantName: "Mont", productId: doc._id, deepLink, priority: 0 });
      created++;
    }
  }
  console.log(`\nby itemType:`, JSON.stringify(byType, null, 0));
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${COMMIT ? created : "(dry)"}, skipped ${skipped} of ${products.length}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
