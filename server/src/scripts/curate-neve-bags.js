/**
 * curate-neve-bags.js — re-model the Neve Gear sleeping bags/quilts onto the locked
 * REI variant standard. They were imported as bare single items (no attributes, no
 * variants). nevegear.com.au (open Shopify) sells each as ONE product page with
 * Comfort-Rating + Height on-page selectors.
 *
 * Per the standard: TEMPERATURE = product identity (its own CatalogItem), LENGTH/
 * HEIGHT = the "Size" variant axis. Decisions (user, 2026-08-06):
 *   - temp = separate items, length = Size variant axis.
 *   - Waratah: list the NEW-style temps only (-2/-6/-10°C); ignore the old in-stock
 *     -8 and the pre-order "Stock" pseudo-axis.
 * Weights: Neve's feed `grams` are 0/placeholder for Bandicoot, Waratah Pro, and the
 * Waratah — left NULL (delegated: don't fabricate, flag TODO), disclosed in copy.
 * Real per-size weights exist only for Waratah UL Summer (550/600/650) and Feathertail
 * (780) → applied. All temps of a model share the one product-page buy-link (selector
 * page → single item-level offer, HMG/Katabatic-Flex precedent).
 *
 * Actions: archive the 3 bare parents (Bandicoot Sleeping Bag / Waratah Pro / Waratah),
 * create 7 temp-split items, update 2 in place (Waratah UL Summer, Feathertail).
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

// temp-split models to (re)create. weights=null → per-size weight unpublished.
const MODELS = [
  { base: "Bandicoot", handle: "bandicoot-sleeping-bag", itemType: "Sleeping Bag", sub: "Sleeping Bags",
    archive: "Bandicoot Sleeping Bag", temps: [-2, -10], sizes: ["Regular", "Long"], weights: null,
    attrs: { insulationType: "Down", shape: "Mummy", gender: "Unisex" } },
  { base: "Waratah Pro", handle: "waratah-pro-1", itemType: "Quilt", sub: "Quilts",
    archive: "Waratah Pro", temps: [0, -6], sizes: ["Regular", "Long"], weights: null,
    attrs: { insulationType: "Down" } },
  { base: "Waratah", handle: "waratah", itemType: "Quilt", sub: "Quilts",
    archive: "Waratah", temps: [-2, -6, -10], sizes: ["Short", "Regular", "Long"], weights: null,
    attrs: { insulationType: "Down", fillPower: 850 },
    weightNote: "Neve lists a nominal ~645 g (430 g of 850FP duck down) for one configuration; per-temperature/size weights are not published." },
];

// existing items to UPDATE in place (real weights available)
const UPDATES = [
  { name: "Waratah UL 4*C Summer Quilt", itemType: "Quilt",
    attrs: { insulationType: "Down", tempRatingC: 4 },
    axis: "Size", sizeWeights: { Short: 550, Regular: 600, Long: 650 }, defaultKey: "Regular" },
  { name: "Feathertail Quilt", itemType: "Quilt",
    attrs: { insulationType: "Down", fillPower: 950, tempRatingC: -6, widthSize: "Wide" },
    weightGrams: 780 }, // single config, no variant
];

async function fetchProducts() {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch("https://nevegear.com.au/products.json?limit=250", { headers: { "User-Agent": UA } });
      if (r.ok) return (await r.json()).products || [];
    } catch (e) { /* retry */ }
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

    // archive the bare parent
    const parent = await C.findOne({ name: m.archive, brand: /neve/i, isActive: true });
    if (parent) { console.log(`ARCHIVE ${m.archive}`); if (COMMIT) await C.collection.updateOne({ _id: parent._id }, { $set: { isActive: false } }); archived++; }

    for (const temp of m.temps) {
      const name = `${m.base} ${tLabel(temp)}`;
      if (await C.findOne({ name, brand: /neve/i })) { console.log(`  exists — skip ${name}`); continue; }
      const variants = m.sizes.map((s) => ({ key: s, options: { Size: s }, ...(m.weights && m.weights[s] != null ? { weightGrams: m.weights[s] } : {}) }));
      const dfltWeight = m.weights ? m.weights["Regular"] ?? null : null;
      const desc =
        `The Neve Gear ${m.base} is a ${m.itemType === "Quilt" ? "down quilt" : "down sleeping bag"} rated to ${tLabel(temp)}, ` +
        `offered in ${m.sizes.join(" / ")} lengths. ` +
        (m.weightNote || "Neve Gear does not publish a per-size weight for this model.");
      console.log(`  CREATE ${name.padEnd(20)} Size[${m.sizes.join(", ")}]`);
      if (COMMIT) {
        const doc = new C({
          name, brand: "Neve Gear", itemType: m.itemType, category: CAT, subcategory: m.sub,
          description: desc, imageUrls: images, createdBy: ADMIN_ID, isActive: true,
          attributes: { ...m.attrs, tempRatingC: temp },
          variantAxes: [{ name: "Size", values: m.sizes }],
          variants, defaultVariantKey: "Regular",
          ...(dfltWeight != null ? { weightGrams: dfltWeight } : {}),
        });
        doc.$locals.lenientAttributes = true;
        try { await doc.save(); } catch (e) { console.log(`     !! ${name}: ${e.message}`); continue; }
        await O.create({ network: "direct", region: "global", merchantId: "direct-nevegear", merchantName: "Neve Gear", productId: doc._id, deepLink, priority: 0 });
        created++;
      }
    }
  }

  for (const u of UPDATES) {
    const it = await C.findOne({ name: u.name, brand: /neve/i });
    if (!it) { console.log(`  !! UPDATE target not found: ${u.name}`); continue; }
    const set = { attributes: { ...(it.attributes || {}), ...u.attrs } };
    if (u.sizeWeights) {
      const sizes = Object.keys(u.sizeWeights);
      set.variantAxes = [{ name: u.axis, values: sizes }];
      set.variants = sizes.map((s) => ({ key: s, options: { [u.axis]: s }, weightGrams: u.sizeWeights[s] }));
      set.defaultVariantKey = u.defaultKey;
      set.weightGrams = u.sizeWeights[u.defaultKey];
    }
    if (u.weightGrams != null) set.weightGrams = u.weightGrams;
    console.log(`  UPDATE ${u.name}  ${u.sizeWeights ? "Size" + JSON.stringify(u.sizeWeights) : "wt=" + u.weightGrams}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set });
    updated++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${archived}, created ${created}, updated ${updated}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
