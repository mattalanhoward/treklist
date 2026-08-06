/**
 * curate-neve-bags.js — model the Neve Gear sleeping bags/quilts/packs onto the locked
 * REI variant standard. They were imported as bare single items (no attributes, no
 * variants). nevegear.com.au (open Shopify) sells each as ONE product page with
 * on-page selectors; the feed `grams` are 0/shipping-placeholder, so real per-variant
 * weights were supplied by the user (2026-08-06, read from the live PDPs).
 *
 * Standard: TEMPERATURE = product identity (own CatalogItem), LENGTH/HEIGHT = "Size"
 * variant axis; pack TORSO = "Torso Size" axis. Decisions (user): temp = separate
 * items; Waratah = new-style temps only (-2/-6/-10°C).
 *
 * Idempotent: archives the bare parents (once), then create-OR-updates each derived
 * item, so re-running refreshes weights/attrs/copy in place. Raw updateOne for existing
 * docs (never .save() on a projected doc). Re-sync to prod after:
 *   node src/scripts/sync-brand-byid-to-prod.js --brand neve --db TrekList --commit --confirm TrekList
 *
 *   node src/scripts/curate-neve-bags.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const tLabel = (t) => `${t}°C`;
const CAT = "Sleep System";

// temp-split models. byTemp: { "<temp>": {Size: grams} | null }. null = weight unpublished.
const MODELS = [
  { base: "Bandicoot", handle: "bandicoot-sleeping-bag", itemType: "Sleeping Bag", sub: "Sleeping Bags",
    archive: "Bandicoot Sleeping Bag", sizes: ["Regular", "Long"],
    attrs: { insulationType: "Down", shape: "Mummy", gender: "Unisex" },
    byTemp: { "-2": null, "-10": null } },
  { base: "Waratah Pro", handle: "waratah-pro-1", itemType: "Quilt", sub: "Quilts",
    archive: "Waratah Pro", sizes: ["Regular", "Long"],
    attrs: { insulationType: "Down" },
    byTemp: { "0": { Regular: 493, Long: 546 }, "-6": { Regular: 598, Long: 664 } } },
  { base: "Waratah", handle: "waratah", itemType: "Quilt", sub: "Quilts",
    archive: "Waratah", sizes: ["Short", "Regular", "Long"],
    attrs: { insulationType: "Down", fillPower: 850 },
    byTemp: {
      "-2": { Short: 563, Regular: 609, Long: 679 },
      "-6": { Short: 639, Regular: 691, Long: 771 },
      "-10": { Short: 730, Regular: 789, Long: 882 },
    } },
];

// existing single/non-temp items to update in place. `variants`: [{key,w,attrs?}].
const UPDATES = [
  { name: "Waratah UL 4*C Summer Quilt", axis: "Size", defaultKey: "Regular",
    attrs: { insulationType: "Down", tempRatingC: 4 },
    variants: [{ key: "Short", w: 435 }, { key: "Regular", w: 450 }, { key: "Long", w: 465 }] },
  { name: "Feathertail Quilt", weightGrams: 720,
    attrs: { insulationType: "Down", fillPower: 950, tempRatingC: -6, widthSize: "Wide", lengthSize: "Regular", fillWeightG: 540, footboxType: "Sewn Closed" } },
  { name: "Wallaroo Pro 55L", axis: "Torso Size", defaultKey: "Medium",
    attrs: { volumeLiters: 55, gender: "Unisex" },
    variants: [{ key: "Medium", w: 825, attrs: { torsoFitRange: "42-50cm" } }, { key: "Large", w: 845, attrs: { torsoFitRange: "45-53cm" } }] },
];

async function fetchProducts() {
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch("https://nevegear.com.au/products.json?limit=250", { headers: { "User-Agent": UA } }); if (r.ok) return (await r.json()).products || []; }
    catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 600 * (t + 1)));
  }
  throw new Error("could not fetch nevegear products.json");
}

(async () => {
  const products = await fetchProducts();
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");

  let archived = 0, created = 0, updated = 0;

  for (const m of MODELS) {
    const fp = byHandle[m.handle];
    const images = fp ? (fp.images || []).map((i) => i.src).slice(0, 6) : [];
    const deepLink = `https://nevegear.com.au/products/${m.handle}`;

    const parent = await C.findOne({ name: m.archive, brand: /neve/i, isActive: true });
    if (parent) { console.log(`ARCHIVE ${m.archive}`); if (COMMIT) await C.collection.updateOne({ _id: parent._id }, { $set: { isActive: false } }); archived++; }

    for (const temp of Object.keys(m.byTemp)) {
      const w = m.byTemp[temp]; // {Size:grams} | null
      const name = `${m.base} ${tLabel(temp)}`;
      const variants = m.sizes.map((s) => ({ key: s, options: { Size: s }, ...(w && w[s] != null ? { weightGrams: w[s] } : {}) }));
      const dflt = w ? w["Regular"] ?? null : null;
      const wLine = w ? `Weights: ${m.sizes.map((s) => `${s} ${w[s]}g`).join(", ")}.` : "Neve Gear does not publish a per-size weight for this model.";
      const desc = `The Neve Gear ${m.base} is a ${m.itemType === "Quilt" ? "down quilt" : "down sleeping bag"} rated to ${tLabel(temp)}, offered in ${m.sizes.join(" / ")} lengths. ${wLine}`;
      const attributes = { ...m.attrs, tempRatingC: Number(temp) };

      const existing = await C.findOne({ name, brand: /neve/i });
      if (existing) {
        console.log(`  UPDATE ${name.padEnd(20)} ${w ? "wt " + JSON.stringify(w) : "(no wt)"}`);
        if (COMMIT) await C.collection.updateOne({ _id: existing._id }, { $set: { isActive: true, attributes, variantAxes: [{ name: "Size", values: m.sizes }], variants, defaultVariantKey: "Regular", description: desc, ...(dflt != null ? { weightGrams: dflt } : { weightGrams: null }) } });
        updated++;
      } else {
        console.log(`  CREATE ${name.padEnd(20)} Size[${m.sizes.join(", ")}]`);
        if (COMMIT) {
          const doc = new C({ name, brand: "Neve Gear", itemType: m.itemType, category: CAT, subcategory: m.sub, description: desc, imageUrls: images, createdBy: ADMIN_ID, isActive: true, attributes, variantAxes: [{ name: "Size", values: m.sizes }], variants, defaultVariantKey: "Regular", ...(dflt != null ? { weightGrams: dflt } : {}) });
          doc.$locals.lenientAttributes = true;
          try { await doc.save(); } catch (e) { console.log(`     !! ${name}: ${e.message}`); continue; }
          await O.create({ network: "direct", region: "global", merchantId: "direct-nevegear", merchantName: "Neve Gear", productId: doc._id, deepLink, priority: 0 });
          created++;
        }
      }
    }
  }

  for (const u of UPDATES) {
    const it = await C.findOne({ name: u.name, brand: /neve/i });
    if (!it) { console.log(`  !! UPDATE target not found: ${u.name}`); continue; }
    const set = { attributes: { ...(it.attributes || {}), ...u.attrs } };
    if (u.variants) {
      set.variantAxes = [{ name: u.axis, values: u.variants.map((v) => v.key) }];
      set.variants = u.variants.map((v) => ({ key: v.key, options: { [u.axis]: v.key }, weightGrams: v.w, ...(v.attrs ? { attributes: v.attrs } : {}) }));
      set.defaultVariantKey = u.defaultKey;
      set.weightGrams = u.variants.find((v) => v.key === u.defaultKey).w;
    }
    if (u.weightGrams != null) set.weightGrams = u.weightGrams;
    console.log(`  UPDATE ${u.name}  ${u.variants ? u.axis + JSON.stringify(u.variants.map((v) => v.key + ":" + v.w)) : "wt=" + u.weightGrams}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set });
    updated++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${archived}, created ${created}, updated ${updated}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
