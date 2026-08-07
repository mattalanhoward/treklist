/**
 * create-zeroggear.js — Zero G Gear (zer0ggear.com), an Australian cottage UL brand on
 * Shopify (open products.json, no bot-wall). The feed is polluted by a Custom Product
 * Builder app: 18 "Quenda Quilt" helper products (product_type cpb_*, variants literally
 * "Variant for price NNN"), a $99999 DEMO test product, and a Dyneema Repair Tape.
 *
 * So this uses an explicit ALLOW-LIST (by handle) — skips all CPB/test/repair noise by
 * construction. Feed grams are 0 everywhere; real weights were hand-read from each PDP's
 * body_html (2026-08-06) and encoded here. Colour dropped (never a variant); Size/Length
 * kept. The Quenda is custom-buildable but Zero G lists 4 ready-made configs with full
 * specs → kept as 4 items (temp/length/width in name). The Apex quilt's 3 length listings
 * collapse to one item + a Length variant axis (Zero G publishes no total weight for it).
 *
 *   node src/scripts/create-zeroggear.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const BRAND = "Zero G Gear";

// allow-list keyed by handle. wt = item grams (null ok). pv = per-variant {key:grams}.
// axis = variant axis to build {name, values} (Size from feed / explicit Length).
const KEEP = {
  "quenda-quilt-1c-203cm-wide": { name: "Quenda Quilt -1°C 203cm Wide", type: "Quilt", wt: 704, attrs: { insulationType: "Down", fillPower: 850, tempRatingC: -1, widthSize: "Wide" } },
  "quenda-quilt-10c-190cm-regular-15d-outer": { name: "Quenda Quilt -10°C 190cm Regular", type: "Quilt", wt: 787, attrs: { insulationType: "Down", fillPower: 850, tempRatingC: -10, widthSize: "Regular" } },
  "quenda-quilt-16c-178cm-regular": { name: "Quenda Quilt -16°C 178cm Regular", type: "Quilt", wt: 816, attrs: { insulationType: "Down", fillPower: 850, tempRatingC: -16, widthSize: "Regular" } },
  "quenda-quilt-16c-178cm-extrawide": { name: "Quenda Quilt -16°C 178cm ExtraWide", type: "Quilt", wt: 979, attrs: { insulationType: "Down", fillPower: 850, tempRatingC: -16, widthSize: "Extra Wide" } },
  "10c-50f-apex-summer-quilt-winter-overquilt-regular": { name: "Apex Summer Quilt / Winter OverQuilt", type: "Quilt", wt: null, attrs: { insulationType: "Synthetic", tempRatingC: 10, syntheticInsulationType: "Climashield Apex" }, axis: { name: "Length", values: ["Short", "Regular", "Long"] }, note: "Synthetic Climashield Apex (5 oz) fill; Zero G does not publish a total weight." },
  "alpha-direct-fuzzy-hoodie": { name: "Alpha Direct 'Fuzzy' Hoodie", type: "Fleece Jacket", wt: 125, attrs: { fleeceType: "Alpha Direct", gender: "Unisex" }, refWt: true, sizeFromFeed: true },
  "alpha-direct-fuzzy-pants": { name: "Alpha Direct 'Fuzzy' Pants", type: "Other", cat: ["Unisex Clothing", "Pants"], wt: 125, attrs: { gender: "Unisex" }, refWt: true, sizeFromFeed: true },
  "alpha-direct-fuzzy-beanies": { name: "Alpha Direct Fuzzy Beanie", type: "Hat/Headwear", wt: 14, attrs: {} },
  "ul-dyneema-dry-bag": { name: "Ultralight Dyneema Dry Bag", type: "Dry Bag / Stuff Sack", pv: { Small: 10, Medium: 13, Large: 16 }, sizeFromFeed: true },
  "1-5oz-dyneema-food-bag": { name: "1.5oz Dyneema Food Bag", type: "Dry Bag / Stuff Sack", wt: null, sizeFromFeed: true },
  "stake-bags": { name: "Stake Bags", type: "Dry Bag / Stuff Sack", wt: 26, attrs: {} },
  "dyneema-pot-sack": { name: "Dyneema Pot Sack", type: "Dry Bag / Stuff Sack", wt: 10, attrs: {} },
  "zero-g-8-5ft-x-10ft-flat-tarp": { name: "Zero G 8.5ft x 10ft Flat Tarp", type: "Tarp Shelter", wt: 200, attrs: {} },
  "zero-g-arc-tarp": { name: "Zero G 'Arc' Tarp", type: "Tarp Shelter", wt: 200, attrs: {}, note: "Zero G lists this as a sub-200 g shelter." },
  "zero-g-gear-oasis-bug-bivy": { name: "Zero G 'Oasis' Bug Bivy", type: "Bivy Sack", wt: 200, attrs: {}, note: "Zero G lists this at just under 200 g." },
  "rain-podgies": { name: "Rain Podgies", type: "Other", cat: ["Accessories & Tools", "Other"], wt: 10, attrs: {}, note: "Rain-shell over-mitts; 10 g the pair." },
};

(async () => {
  const products = [];
  for (let page = 1; page <= 10; page++) { const j = await (await fetch(`https://zer0ggear.com/products.json?limit=250&page=${page}`, { headers: { "User-Agent": UA } })).json(); if (!j.products.length) break; products.push(...j.products); if (j.products.length < 250) break; }
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0;

  for (const [handle, cfg] of Object.entries(KEEP)) {
    const p = byHandle[handle];
    if (!p) { console.log(`?? NOT IN FEED: ${handle}`); continue; }
    if (await C.findOne({ name: cfg.name, brand: BRAND })) { console.log(`exists — skip ${cfg.name}`); continue; }

    // variant axis: explicit, or from the feed's non-colour Size option
    let variantAxes, variants, defaultVariantKey;
    let sizes = null;
    if (cfg.axis) sizes = cfg.axis.values, variantAxes = [{ name: cfg.axis.name, values: sizes }];
    else if (cfg.sizeFromFeed) { const so = (p.options || []).find((o) => !/colou?r|inner|title/i.test(o.name)); if (so) { sizes = so.values; variantAxes = [{ name: so.name, values: sizes }]; } }
    if (sizes) {
      const axisName = variantAxes[0].name;
      variants = sizes.map((s) => ({ key: s, options: { [axisName]: s }, ...(cfg.pv && cfg.pv[s] != null ? { weightGrams: cfg.pv[s] } : {}) }));
      defaultVariantKey = sizes.includes("Medium") ? "Medium" : sizes.includes("Regular") ? "Regular" : sizes[0];
    }
    const itemWt = cfg.pv ? (cfg.pv[defaultVariantKey] ?? null) : cfg.wt;

    const [cat, sub] = cfg.cat || (() => { const r = categoryForItemType(cfg.type, cfg.name); return [r.category, r.subcategory]; })();
    const images = (p.images || []).map((i) => i.src).slice(0, 6);
    const deepLink = `https://zer0ggear.com/products/${handle}`;
    const body = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim().slice(0, 360);
    const refNote = cfg.refWt ? " Listed weight is a reference-size (Medium) figure and does not vary by the size selected here." : "";
    const desc = `${body}${cfg.note ? " " + cfg.note : ""}${refNote}`;

    console.log(`${cfg.type.padEnd(20)} ${cfg.name.slice(0, 40).padEnd(40)} ${itemWt ?? "null"}g ${sizes ? "[" + sizes.join("/") + "]" : ""}`);
    if (COMMIT) {
      if (!images.length) { console.log(`  !! no images — skip`); continue; }
      const doc = new C({
        name: cfg.name, brand: BRAND, itemType: cfg.type, category: cat, subcategory: sub,
        description: desc, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
        ...(itemWt != null ? { weightGrams: itemWt } : {}), attributes: cfg.attrs || {},
        ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`  !! ${cfg.name}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-zeroggear", merchantName: BRAND, productId: doc._id, deepLink, priority: 0 });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? created + " created" : Object.keys(KEEP).length + " in allow-list"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
