/**
 * create-ff-resold-apparel.js — import the Arc'teryx + Patagonia APPAREL that
 * Feathered Friends resells (found while doing FF's own line 2026-07-09). User wants
 * these for catalog value even though the offer points at a reseller for now.
 *
 * ⚠ RESOLD OFFER — READ: the catalog item's `brand` is the ACTUAL brand (Arc'teryx /
 * Patagonia), but the MerchantOffer is Feathered Friends (`merchantId:
 * "direct-featheredfriends"`, FF product-page deepLink) because that's where we can
 * currently link. **When we get Arc'teryx / Patagonia direct or affiliate access,
 * re-point these offers** — find them with: offers whose `merchantId ==
 * "direct-featheredfriends"` on a CatalogItem whose brand is Arc'teryx/Patagonia
 * (brand ≠ retailer is the signal; no special flag needed).
 *
 * Typing: FF tags each resold item with garment-type + material tags
 * (Top/Bottom/Short/Handwear + Hardshell/Softshell/Fleece/Insulation/Down/Baselayer)
 * — 100% of in-scope items carry one, so we type by TAG (reliable) rather than by
 * Arc/Pat's cryptic model names. Gender from the Men's/Women's tag. Color collapsed,
 * Size = variant axis.
 *
 * WEIGHTS: FF feed `grams` are round shipping weights (Norvan shell = 907g shipped
 * vs ~200g real) — useless. But the REAL garment weight is the last item of the
 * features list in body_html, "X.X oz (NNN g)" — pulled here (~164/169 have it).
 * FF's copy states NO reference size (Arc/Pat quote a single spec weight, usually
 * men's M / women's S, but FF stripped the label) → honest generic disclaimer, not
 * an invented "size M". (backfill-ff-resold-weights.js did the same for the first
 * batch that went in weightless before this was added.)
 *
 * Scope: vendor Arc'teryx (195) + Patagonia (45); keep IN-STOCK + not `bis-hidden`
 * (169). Includes discontinued/sale-rack still-in-stock items (catalog value; a user
 * may own them).
 *
 *   node src/scripts/create-ff-resold-apparel.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ADMIN_ID = "69565d7c3480c2216f915a36";
const FEED = "https://featheredfriends.com/products.json?limit=250";

function resolveType(tags) {
  const has = (t) => tags.includes(t);
  const bottom = has("Bottom") || has("Pant");
  if (has("Handwear")) return "Gloves (Insulated)";
  if (has("Short")) return "Hiking Shorts";
  if (has("Baselayer")) return bottom ? "Base Layer Bottom" : "Base Layer Top";
  if (has("Hardshell")) return bottom ? "Rain Pants" : "Rain Jacket";
  if (has("Softshell")) return bottom ? "Hiking Pants" : "Softshell Jacket";
  if (has("Fleece")) return bottom ? "Hiking Pants" : "Fleece Jacket";
  if (has("Down") || has("Puffy Jacket") || has("Insulation") || has("Synthetic Puffy Jackets and Pants"))
    return bottom ? "Hiking Pants" : "Insulated Jacket";
  if (has("T-Shirt") || has("Shirt")) return "Hiking Shirt";
  if (bottom) return "Hiking Pants";
  return "Hiking Shirt"; // generic Top
}
function genderOf(tags) {
  if (tags.includes("Women's")) return "Womens";
  if (tags.includes("Men's")) return "Mens";
  return "Unisex";
}
function cleanName(title) {
  return title
    .replace(/\s+[FS]\d{2}\b/g, "")
    .replace(/\s*-\s*(closeout|sale|past season|discontinued|previous model).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function gallery(p) {
  return (p.images || []).map((i) => (i.src.startsWith("http") ? i.src : "https:" + i.src)).slice(0, 8);
}
const WEIGHT_DISCLAIMER = "Listed weight is the manufacturer's reference-size weight; actual weight varies by size.";
function parseWeight(html) {
  const m = (html || "").match(/([\d.]+)\s*oz\s*\(\s*(\d[\d,]*)\s*g\s*\)/i);
  return m ? parseInt(m[2].replace(/,/g, "")) : null;
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 3; page++) {
    let json;
    for (let t = 0; t < 3 && !json; t++) {
      try {
        const res = await fetch(`${FEED}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) json = await res.json();
      } catch (e) { /* retry */ }
      if (!json) await new Promise((r) => setTimeout(r, 500));
    }
    if (!json || !json.products?.length) break;
    out.push(...json.products);
  }
  return out;
}

(async () => {
  const products = await fetchAll();
  const scope = products.filter(
    (p) => /^(Arc|Patagonia)/i.test(p.vendor || "") && p.variants.some((v) => v.available) && !p.tags.includes("bis-hidden")
  );
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let created = 0;
  const counts = {};
  for (const p of scope) {
    const brand = /^Arc/i.test(p.vendor) ? "Arc'teryx" : "Patagonia";
    const name = cleanName(p.title);
    const existing = await C.findOne({ name, brand, isActive: true }).lean();
    if (existing) { console.log(`${name}: already active — skip`); continue; }

    const itemType = resolveType(p.tags);
    const gender = genderOf(p.tags);
    const { category, subcategory } = categoryForItemType(itemType, gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : "");
    const images = gallery(p);
    const weightGrams = parseWeight(p.body_html);
    let description = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
    if (weightGrams) description += "\n\n* " + WEIGHT_DISCLAIMER;

    const sizeOpt = p.options.find((o) => /size/i.test(o.name));
    let variantAxes, variants, defaultVariantKey;
    if (sizeOpt && sizeOpt.values.length > 1) {
      variantAxes = [{ name: "Size", values: sizeOpt.values }];
      variants = sizeOpt.values.map((s) => ({ key: s, options: { Size: s } }));
      defaultVariantKey = sizeOpt.values[0];
    }

    counts[`${brand.slice(0, 4)}:${itemType}`] = (counts[`${brand.slice(0, 4)}:${itemType}`] || 0) + 1;
    console.log(`${brand.padEnd(10)} ${name.slice(0, 38).padEnd(38)} ${itemType.padEnd(18)} ${gender.padEnd(7)} imgs:${images.length} ${variantAxes ? "Size[" + sizeOpt.values.length + "]" : ""}`);

    if (COMMIT) {
      if (!images.length) { console.log(`   !! ${name}: no images — skip`); continue; }
      const doc = new C({
        name, brand, itemType,
        ...(category ? { category, subcategory } : {}),
        description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(weightGrams != null ? { weightGrams } : {}),
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
        attributes: { gender },
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({
        network: "direct", region: "global", merchantId: "direct-featheredfriends", merchantName: "Feathered Friends",
        productId: doc._id, deepLink: `https://featheredfriends.com/products/${p.handle}`, priority: 0,
      });
      created++;
    }
  }
  console.log(`\nby brand:itemType:`, counts);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created}/${scope.length} created`);
  await mongoose.disconnect();
})();
