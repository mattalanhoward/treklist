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
  "10c-50f-apex-summer-quilt-winter-overquilt-regular": { name: "Apex Summer Quilt / Winter OverQuilt", type: "Quilt", pv: { Short: 400, Regular: 415, Long: 435 }, attrs: { insulationType: "Synthetic", tempRatingC: 10, syntheticInsulationType: "Climashield Apex" }, axis: { name: "Length", values: ["Short", "Regular", "Long"] },
    desc: "Superlight synthetic summer quilt / winter over-quilt, comfort rated around +8 to +10 °C. 10D ripstop-nylon shell (DWR treated) with 2.5 oz Climashield Apex insulation, zippered foot-box with cinch cord, full pad-attachment system, and KAM-snap/draw-cord neck. Lengths: Short ~400 g (180 cm), Regular ~415 g (190 cm), Long ~435 g (200 cm) — weights approximate." },
  "alpha-direct-fuzzy-hoodie": { name: "Alpha Direct 'Fuzzy' Hoodie", type: "Fleece Jacket", wt: 125, attrs: { fleeceType: "Alpha Direct", gender: "Unisex" }, refWt: true, sizeFromFeed: true },
  "alpha-direct-fuzzy-pants": { name: "Alpha Direct 'Fuzzy' Pants", type: "Other", cat: ["Unisex Clothing", "Pants"], wt: 125, attrs: { gender: "Unisex" }, refWt: true, sizeFromFeed: true },
  "alpha-direct-fuzzy-beanies": { name: "Alpha Direct Fuzzy Beanie", type: "Hat/Headwear", wt: 14, attrs: {} },
  "ul-dyneema-dry-bag": { name: "Ultralight Dyneema Dry Bag", type: "Dry Bag / Stuff Sack", pv: { Small: 10, Medium: 13, Large: 16 }, sizeFromFeed: true },
  "1-5oz-dyneema-food-bag": { name: "1.5oz Dyneema Food Bag", type: "Dry Bag / Stuff Sack", pv: { Small: 20, Medium: 28, Large: 33 }, pvVol: { Small: 5, Medium: 13, Large: 16 }, sizeFromFeed: true,
    attrs: { closureType: "Roll-Top", material: "1.43 oz Dyneema Composite Fabric", waterproof: true, seamSealed: true },
    desc: "Tough, ultralight roll-top food bag in 1.43 oz Dyneema Composite Fabric with a buckle + Kam-Snap closure and fully-taped Challenge TNT seams (waterproof). 10 cm square base. Sizes: Small 20 g — 33×23×10 cm, ~5 L (1–2 days); Medium 28 g — 39×34×10 cm, ~13 L (3–4 days); Large 33 g — 41×40×10 cm, ~16 L (week-long hauls)." },
  "stake-bags": { name: "Stake Bags", type: "Dry Bag / Stuff Sack", wt: 26, attrs: {} },
  "dyneema-pot-sack": { name: "Dyneema Pot Sack", type: "Dry Bag / Stuff Sack", wt: 10, attrs: {} },
  "zero-g-8-5ft-x-10ft-flat-tarp": { name: "Zero G 8.5ft x 10ft Flat Tarp", type: "Tarp Shelter", wt: 200,
    attrs: { shape: "Rectangular", widthCm: 260, lengthCm: 300, coverageAreaSqM: 7.8, material: "0.8 oz Dyneema Composite Fabric", guyoutPoints: 6, tieoutsIncluded: true },
    desc: "Minimalist ultralight flat tarp, 8.5 ft × 10 ft (2.6 m × 3 m) — plenty of room for you and your gear with the widest range of pitching options. Total weight 200 g including guylines, in 0.8 oz Dyneema Composite Fabric. Fully-bonded seamless ridgeline, 2.92 oz hybrid-Dyneema reinforced tie-outs, LineLoc V adjusters on every corner and both ridgeline ends, 1.3 mm reflective cord." },
  "zero-g-arc-tarp": { name: "Zero G 'Arc' Tarp", type: "Tarp Shelter", wt: 200,
    attrs: { shape: "Catenary Cut", lengthCm: 300, widthCm: 260, material: "0.8 oz Dyneema Composite Fabric", guyoutPoints: 6, tieoutsIncluded: true },
    desc: "Catenary-cut ultralight tarp — the lightest shelter in the Zero G lineup, sub-200 g (guylines included) in 0.8 oz Dyneema Composite Fabric. Tapered design; bonded seamless ridgeline; 2.92 oz Dyneema reinforcements; 6 LineLoc V tie-outs with 1.3 mm reflective guyline. Straight-line dims: ridgeline 300 cm, front width 2.6 m, rear width 2.2 m, ground length 2.7 m, front/rear height 125/90 cm." },
  "zero-g-gear-oasis-bug-bivy": { name: "Zero G 'Oasis' Bug Bivy", type: "Bivy Sack", wt: 200,
    attrs: { capacity: "1-Person", waterproof: false, material: "0.67 oz No-See-Um mesh body, 0.8 oz Dyneema floor" },
    desc: "Ultralight bug bivy, just under 200 g, for maximum bug protection at minimal weight. 0.67 oz No-See-Um mesh keeps out even the smallest insects; 0.8 oz Dyneema waterproof floor with a 10 cm bathtub; #3 full-ridgeline zip for access from both sides; elasticated corner/ridgeline tie-outs. Pairs with the Zero G Flat and Arc tarps." },
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
    // variant axis: explicit, or from the feed's non-colour Size option
    let variantAxes, variants, defaultVariantKey;
    let sizes = null;
    if (cfg.axis) sizes = cfg.axis.values, variantAxes = [{ name: cfg.axis.name, values: sizes }];
    else if (cfg.sizeFromFeed) { const so = (p.options || []).find((o) => !/colou?r|inner|title/i.test(o.name)); if (so) { sizes = so.values; variantAxes = [{ name: so.name, values: sizes }]; } }
    if (sizes) {
      const axisName = variantAxes[0].name;
      variants = sizes.map((s) => {
        const va = {};
        if (cfg.pvVol && cfg.pvVol[s] != null) va.volumeLiters = cfg.pvVol[s];
        return { key: s, options: { [axisName]: s }, ...(cfg.pv && cfg.pv[s] != null ? { weightGrams: cfg.pv[s] } : {}), ...(Object.keys(va).length ? { attributes: va } : {}) };
      });
      defaultVariantKey = sizes.includes("Medium") ? "Medium" : sizes.includes("Regular") ? "Regular" : sizes[0];
    }
    const itemWt = cfg.pv ? (cfg.pv[defaultVariantKey] ?? null) : cfg.wt;

    const [cat, sub] = cfg.cat || (() => { const r = categoryForItemType(cfg.type, cfg.name); return [r.category, r.subcategory]; })();
    const images = (p.images || []).map((i) => i.src).slice(0, 6);
    const deepLink = `https://zer0ggear.com/products/${handle}`;
    const body = (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim().slice(0, 360);
    const refNote = cfg.refWt ? " Listed weight is a reference-size (Medium) figure and does not vary by the size selected here." : "";
    const desc = cfg.desc || `${body}${cfg.note ? " " + cfg.note : ""}${refNote}`;
    const attributes = { ...(cfg.attrs || {}), ...(cfg.pvVol ? { volumeLiters: cfg.pvVol[defaultVariantKey] } : {}) };
    const setFields = {
      name: cfg.name, brand: BRAND, itemType: cfg.type, category: cat, subcategory: sub,
      description: desc, imageUrls: images, isActive: true, attributes,
      ...(variantAxes ? { variantAxes, variants, defaultVariantKey } : {}),
    };

    const existing = await C.findOne({ name: cfg.name, brand: BRAND });
    console.log(`${existing ? "UPD" : "NEW"} ${cfg.type.padEnd(18)} ${cfg.name.slice(0, 38).padEnd(38)} ${itemWt ?? "null"}g ${sizes ? "[" + sizes.join("/") + "]" : ""}`);
    if (COMMIT) {
      if (existing) {
        await C.collection.updateOne({ _id: existing._id }, { $set: { ...setFields, weightGrams: itemWt ?? null } });
      } else {
        if (!images.length) { console.log(`  !! no images — skip`); continue; }
        const doc = new C({ ...setFields, createdBy: ADMIN_ID, ...(itemWt != null ? { weightGrams: itemWt } : {}) });
        doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`  !! ${cfg.name}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-zeroggear", merchantName: BRAND, productId: doc._id, deepLink, priority: 0 });
      }
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${COMMIT ? created + " created" : Object.keys(KEEP).length + " in allow-list"}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
