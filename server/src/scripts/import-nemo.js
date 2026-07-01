/**
 * import-nemo.js — dedicated Nemo Equipment importer (Shopify feed + per-page weight
 * scrape). The generic ingest collapses Nemo's variants to flat items because the
 * feed has NO weights; Nemo's value is the variant structure (bags = Temp×Length,
 * tents = Capacity, pads = Size) + real weights, which live only in each product
 * page's embedded spec JSON ("specification":"Minimum Weight","value":".../ X kg").
 *
 * Builds items with variantAxes (feed options minus Color) + per-variant weightGrams
 * (scraped Minimum Weight, mapped in feed order; falls back to the min weight on all
 * variants if counts don't align). Direct (unmonetized) nemoequipment.com offers.
 * Keeps backpacking product types; drops car-camping (Camp Life / Camp Furniture).
 *
 *   node src/scripts/import-nemo.js [--commit] [--limit N]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? Number(process.argv[i + 1]) : Infinity; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ADMIN_ID = "69565d7c3480c2216f915a36";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
// backpacking core only. "Carry Systems"/"Packs" = travel/everyday bags (Vantage/
// Double Haul duffels/Endless Promise travel) — NOT backpacking; drop.
const KEEP_TYPES = /tent|sleeping bag|sleeping pad|pillow|quilt/i;
const DROP = /camp life|camp furniture|furniture|blanket|chair|cot\b/i;
const DROP_TITLE = /gift card|blanket|stargaze|moonlite|chair|victory|heliopolis|aurora highrise|footprint stake/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kgToG = (val) => {
  const kg = String(val).match(/([\d.]+)\s*kg/i);
  if (kg) return Math.round(parseFloat(kg[1]) * 1000);
  const lb = String(val).match(/(\d+)\s*lb/i);
  const oz = String(val).match(/(\d+)\s*oz/i);
  if (lb || oz) return Math.round(((lb ? +lb[1] : 0) * 16 + (oz ? +oz[1] : 0)) * 28.3495);
  return null;
};

async function scrapeMinWeights(handle) {
  try {
    const res = await fetch(`https://www.nemoequipment.com/products/${handle}`, { headers: { "User-Agent": UA } });
    const html = await res.text();
    const pairs = [...html.matchAll(/"specification":"([^"]+)","value":"([^"]+)"/g)];
    const mins = pairs.filter((m) => /^minimum weight$/i.test(m[1])).map((m) => kgToG(m[2].replace(/\\\//g, "/"))).filter(Boolean);
    // de-dupe consecutive repeats (pages sometimes repeat a summary block)
    return mins;
  } catch (e) {
    return [];
  }
}

// collapse a product's variants by its non-Color options
function buildVariants(product) {
  const opts = (product.options || []).filter((o) => o.name !== "Title" && !/colou?r/i.test(o.name));
  const axisNames = opts.map((o) => o.name);
  const idxByName = {};
  (product.options || []).forEach((o, i) => (idxByName[o.name] = `option${i + 1}`));
  const seen = new Map();
  for (const v of product.variants || []) {
    const key = axisNames.map((n) => v[idxByName[n]]).join(" / ");
    if (!seen.has(key)) seen.set(key, { key, options: Object.fromEntries(axisNames.map((n) => [n, v[idxByName[n]]])) });
  }
  return { axisNames, opts, variants: [...seen.values()] };
}

(async () => {
  const feedRes = await fetch("https://www.nemoequipment.com/products.json?limit=250", { headers: { "User-Agent": UA } });
  const products = (await feedRes.json()).products || [];
  const keep = products.filter((p) => KEEP_TYPES.test(p.product_type || "") && !DROP.test(p.product_type || "") && !DROP_TITLE.test(p.title));
  console.log(`feed ${products.length} → keep ${keep.length} backpacking (drop car-camping/lifestyle)`);

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0, n = 0;

  for (const p of keep) {
    if (n >= LIMIT) break;
    n++;
    if (await C.findOne({ name: p.title, brand: /nemo/i }).lean()) { skipped++; continue; }
    const { axisNames, opts, variants } = buildVariants(p);

    // ⚠ WEIGHTS DEFERRED: the page spec JSON has "Minimum Weight" per variant, but
    // it's mixed with accessory/component + summary values, so automated extraction
    // is unreliable (Tensor pads scraped ~142 g vs ~450 g real). Import weightless;
    // a careful per-page-structure weight pass is a TODO. scrapeMinWeights() kept for it.
    const baseWeight = undefined;
    const multi = variants.length > 1 && axisNames.length > 0;
    const variantAxes = multi ? opts.map((o) => ({ name: o.name, values: [...new Set(variants.map((v) => v.options[o.name]))] })) : [];
    const builtVariants = multi ? variants.map((v) => ({ key: v.key, options: v.options })) : [];
    const defWeight = baseWeight;

    console.log(`${p.title.slice(0, 40).padEnd(42)} ${(p.product_type || "").padEnd(14)} ${multi ? `${axisNames.join("×")}[${variants.length}]` : "flat"}`);

    if (COMMIT) {
      const images = (p.images || []).map((i) => i.src).slice(0, 10);
      const doc = new C({
        name: p.title,
        brand: "Nemo",
        description: (p.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
        imageUrls: images,
        createdBy: ADMIN_ID,
        isActive: true,
        weightGrams: defWeight,
        ...(multi ? { variantAxes, variants: builtVariants, defaultVariantKey: builtVariants[0].key } : {}),
      });
      doc.$locals.lenientAttributes = true;
      try { await doc.save(); } catch (e) { console.log(`   !! ${p.title}: ${e.message}`); continue; }
      await O.create({ network: "direct", region: "global", merchantId: "direct-nemo", merchantName: "Nemo", productId: doc._id, deepLink: `https://www.nemoequipment.com/products/${p.handle}`, priority: 0 });
      created++;
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: created ${created}, skipped-existing ${skipped}, processed ${n}`);
  await mongoose.disconnect();
})();
