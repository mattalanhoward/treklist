/**
 * create-blackdiamond-apparel.js — the BD apparel pass the user asked for (2026-07-08),
 * a follow-up to create-blackdiamond.js (which did hard goods). Same Shopify feed,
 * same real per-size feed weights (used directly, captured per Size variant — BD
 * publishes them, so no reference-size disclaimer needed).
 *
 * Requested categories (BD product_type) and their itemType mapping — mapping is
 * per-ITEM (name-based), not just per product_type, because BD's feed categories
 * don't line up with a clean gear taxonomy:
 *   Shells      -> Rain Jacket, EXCEPT softshells (Alpine Start / Distance Wind
 *                  Shell) -> Softshell Jacket  [new itemType, user's call]
 *   Insulation  -> Insulated Jacket
 *   Fleece      -> Fleece Jacket, EXCEPT the Coefficient LT thermal line -> Base Layer Top
 *   Hoodies     -> split by kind (user's call): Alpenglow (sun hoody) -> Hiking Shirt;
 *                  everything else -> Fleece Jacket. Minus the 3 excluded merch hoodies.
 *   Pants       -> Hiking Pants, EXCEPT rain -> Rain Pants, Coefficient LT -> Base Layer Bottom
 *   Shorts      -> Hiking Shorts
 *   Gloves (Everyday/Mountaineering/Climbing/Running) -> Gloves (Insulated)
 *   Beanies     -> Hat/Headwear, EXCEPT the "Coefficient LT Gaiter" (a neck gaiter
 *                  filed under Beanies) -> Neck Gaiter
 *
 * NOT imported (not in the user's list): Tees, Shirts, HEX Tops/Bottoms, Ski* gloves,
 * Crew Socks. Excluded per-item: Past-Season, and the 3 named merch hoodies
 * (Engineered Diamond Pullover Hoody, Mini Stacked Pullover Hoody, Mini Stacked Full
 * Zip Hoody). Color collapsed; Size = variant axis with per-size feed weights.
 *
 * Attributes kept shallow (gender, set from name) — deep apparel attrs (membrane,
 * fill, fabric weight) are a possible phase-2, matching the OR-apparel precedent.
 *
 *   node src/scripts/create-blackdiamond-apparel.js [--commit]
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
const FEED_BASE = "https://www.blackdiamondequipment.com/products.json?limit=250";
const APPAREL_TYPES = new Set([
  "Shells", "Insulation", "Fleece", "Hoodies", "Pants", "Shorts",
  "Everyday Gloves", "Mountaineering Gloves", "Climbing Gloves", "Running Gloves", "Beanies",
]);
const JUNK = /past season/i;
const HOODY_EXCLUDE = /engineered diamond pullover hoody|mini stacked pullover hoody|mini stacked full zip hoody/i;
// "Beta Belt" = a webbing belt mis-filed under the Beanies product_type (not headwear).
const NAME_EXCLUDE = /beta belt/i;
// Thin legacy apparel entries superseded by the richer gendered/per-size feed versions.
const SUPERSEDE = ["Fineline Stretch Shell", "Men's Crag Half-Finger Gloves"];

const GLOVE_TYPES = new Set(["Everyday Gloves", "Mountaineering Gloves", "Climbing Gloves", "Running Gloves"]);

function resolveType(p) {
  const t = p.product_type;
  const n = p.title;
  if (t === "Shells") return /alpine start|wind\s?shell|windshirt/i.test(n) ? "Softshell Jacket" : "Rain Jacket";
  if (t === "Insulation") return "Insulated Jacket";
  if (t === "Fleece") return /coefficient lt/i.test(n) ? "Base Layer Top" : "Fleece Jacket";
  if (t === "Hoodies") return /alpenglow/i.test(n) ? "Hiking Shirt" : "Fleece Jacket";
  if (t === "Pants") return /rain/i.test(n) ? "Rain Pants" : /coefficient lt/i.test(n) ? "Base Layer Bottom" : "Hiking Pants";
  if (t === "Shorts") return "Hiking Shorts";
  if (GLOVE_TYPES.has(t)) return "Gloves (Insulated)";
  if (t === "Beanies") return /gaiter/i.test(n) ? "Neck Gaiter" : "Hat/Headwear";
  return null;
}

const WOMENS = /\b(women[’']?s|woman[’']?s|female|ladies)\b/i;
const MENS = /\b(men[’']?s|man[’']?s|male)\b/i;
function gender(name) {
  const w = WOMENS.test(name), m = MENS.test(name);
  if (w && !m) return "Womens";
  if (m && !w) return "Mens";
  return "Unisex";
}

function gallery(p) {
  const first = p.images?.[0];
  if (!first) return [];
  const parts = first.src.split("/").pop().split("?")[0].split("_");
  if (parts.length >= 3) {
    const prefix = parts.slice(0, 2).join("_") + "_";
    const g = p.images.filter((im) => im.src.split("/").pop().startsWith(prefix)).map((im) => im.src);
    if (g.length) return g.slice(0, 10);
  }
  return p.images.map((im) => im.src).slice(0, 10);
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 6; page++) {
    let json;
    for (let t = 0; t < 3 && !json; t++) {
      try {
        const res = await fetch(`${FEED_BASE}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
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
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  const inScope = products.filter(
    (p) => APPAREL_TYPES.has(p.product_type) && p.variants.some((v) => v.available) && !JUNK.test(p.title) && !HOODY_EXCLUDE.test(p.title) && !NAME_EXCLUDE.test(p.title)
  );

  if (COMMIT) {
    const arch = await C.updateMany({ brand: /black diamond/i, name: { $in: SUPERSEDE }, isActive: true }, { $set: { isActive: false } });
    console.log(`archived ${arch.modifiedCount} superseded legacy apparel item(s)\n`);
  }

  let created = 0;
  const counts = {};
  for (const p of inScope) {
    const itemType = resolveType(p);
    if (!itemType) continue;
    const name = p.title.trim();
    const existing = await C.findOne({ name, brand: /black diamond/i, isActive: true }).lean();
    if (existing) { console.log(`${name}: already active — skip`); continue; }

    const g = gender(name);
    const { category, subcategory } = categoryForItemType(itemType, name);

    // Size variant axis (color collapsed), per-size feed weights.
    let variantAxes, variants, defaultVariantKey, itemWeight;
    const sizeIdx = p.options.findIndex((o) => o.name === "Size");
    if (sizeIdx >= 0 && p.options[sizeIdx].values.length > 1) {
      const optKey = "option" + (sizeIdx + 1);
      const sizes = p.options[sizeIdx].values;
      variants = sizes.map((s) => {
        const vs = p.variants.filter((v) => v[optKey] === s);
        const av = vs.find((v) => v.available) || vs[0];
        return { key: s, options: { Size: s }, weightGrams: av?.grams > 0 ? av.grams : undefined };
      });
      variantAxes = [{ name: "Size", values: sizes }];
      const firstAvail = p.variants.find((v) => v.available);
      defaultVariantKey = firstAvail ? firstAvail[optKey] : sizes[0];
      itemWeight = (variants.find((v) => v.key === defaultVariantKey) || variants[0]).weightGrams ?? null;
    } else {
      const av = p.variants.find((v) => v.available) || p.variants[0];
      itemWeight = av?.grams > 0 ? av.grams : null;
    }

    const images = gallery(p);
    const deepLink = `https://www.blackdiamondequipment.com/products/${p.handle}`;
    const description = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
    const attributes = { gender: g };

    counts[itemType] = (counts[itemType] || 0) + 1;
    console.log(`${name.slice(0, 42).padEnd(42)} ${itemType.padEnd(18)} ${g.padEnd(7)} ${itemWeight ?? "?"}g  imgs:${images.length}  ${variantAxes ? "Size[" + variants.map((v) => v.key + "=" + (v.weightGrams ?? "?")).join(",") + "]" : "one-size"}`);

    if (COMMIT) {
      if (!images.length) { console.log(`   !! ${name}: no images — skip`); continue; }
      const doc = new C({
        name, brand: "Black Diamond", itemType,
        ...(category ? { category, subcategory } : {}),
        description, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(itemWeight != null ? { weightGrams: itemWeight } : {}),
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
        attributes,
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-blackdiamond", merchantName: "Black Diamond", productId: doc._id, deepLink, priority: 0 });
      created++;
    }
  }
  console.log(`\nby itemType:`, counts);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created}/${inScope.length} created`);
  await mongoose.disconnect();
})();
