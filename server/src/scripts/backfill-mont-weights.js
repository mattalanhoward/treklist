/**
 * backfill-mont-weights.js — Mont's Shopify feed has grams=0 for 22 items, but the
 * real weights live in the "Specifications" block of each PDP's HTML (parsed 2026-08-06):
 *   - sleeping bags: per-size "(NNNg) total" + "(NNNg) fill"
 *   - jackets/vests: "Jacket Weight: NNNg" + "Fill Weight: NNNg" (reference size)
 *   - shirts: "Weight: NNNg" (reference size)
 *   - cap: per-size-group oz → g
 *   - compression sack: per-size grams were in the FEED (default XS was 0 → item looked
 *     weightless); backfilled from the feed here.
 * 4 items publish no weight anywhere (women's Helios jacket, both Warmlite mats, Mojo
 * zip-off pants) → left null.
 *
 * Keyed by Shopify handle (title resolved from the live feed → avoids apostrophe issues).
 * Bag per-size weights map to variant keys by prefix (Standard/Extra Large/Womens).
 *
 *   node src/scripts/backfill-mont-weights.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

// bags: per-size {total, fill} by size-prefix. std=Standard*, xl=Extra Large*, women=Womens*
const BAGS = {
  "brindabella-xt-850-14-to-3-f-down-sleeping-bag-1": { std: [1485, 850], xl: [1640, 950], women: [1455, 850] },
  "spindrift-xt-850-9-to-2-f-down-sleeping-bag":       { std: [1430, 850], xl: [1600, 950], women: [1400, 850] },
  "spindrift-xt-700-19-to-9-f-down-sleeping-bag":      { std: [1265, 700], xl: [1430, 800] }, // no women's weight published
  "brindabella-xt-700-21-to-10-f-down-sleeping-bag-1": { std: [1330, 700], xl: [1465, 800], women: [1305, 700] },
};
// single reference weight (+ optional fill) — apparel, flat across sizes
const SINGLE = {
  "helios-vest-women": { w: 323, fill: 120 }, "helios-jkt-men": { w: 555, fill: 220 }, "helios-vest-men": { w: 346, fill: 125 },
  "guide-hoodie-g-loft-women": { w: 355 }, "guide-hoodie-g-loft-men": { w: 395 },
  "sundance-long-sleeve-zip-polo-womens": { w: 143 }, "sundance-long-sleeve-zip-polo-mens": { w: 183 },
  "sundance-short-sleeve-crew-t-shirt-womens": { w: 91 }, "sundance-short-sleeve-crew-t-shirt-mens-1": { w: 114 },
  "sundance-hoodie-womens-1": { w: 147 }, "sundance-hoodie-mens": { w: 177 },
};
// per-variant weights by exact variant key (cap: oz→g; compression sack: from feed)
const PERVAR = {
  "cadence-active-cap": { map: { "SM/MD": 54, "LG/XL": 57 }, item: 54 },
  "z-force-mechanical-advantage-compression-sack": { map: { SM: 103, MD: 107, LG: 119, XL: 124, "2XL": 126 }, item: 103 },
};
const prefix = (k) => (/^extra large/i.test(k) ? "xl" : /^womens/i.test(k) ? "women" : /^standard/i.test(k) ? "std" : null);

(async () => {
  const feed = await (await fetch("https://mont.equipment/products.json?limit=250", { headers: { "User-Agent": UA } })).json();
  let page = 2; while (true) { const j = await (await fetch(`https://mont.equipment/products.json?limit=250&page=${page}`, { headers: { "User-Agent": UA } })).json(); if (!j.products.length) break; feed.products.push(...j.products); if (j.products.length < 250) break; page++; }
  const title = (h) => (feed.products.find((p) => p.handle === h) || {}).title;

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;

  for (const [h, sz] of Object.entries(BAGS)) {
    const it = await C.findOne({ name: title(h), brand: "Mont" }); if (!it) { console.log("?? missing", h); continue; }
    const variants = (it.variants || []).map((v) => { const p = prefix(v.key); const s = p && sz[p]; return { key: v.key, options: v.options, ...(s ? { weightGrams: s[0], attributes: { ...(v.attributes || {}), fillWeightG: s[1] } } : {}) }; });
    const set = { variants, weightGrams: sz.std[0], attributes: { ...(it.attributes || {}), fillWeightG: sz.std[1] } };
    console.log(`BAG   ${it.name.slice(0, 46).padEnd(46)} std ${sz.std[0]}g / xl ${sz.xl[0]}g${sz.women ? " / women " + sz.women[0] + "g" : ""}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set }); n++;
  }
  for (const [h, d] of Object.entries(SINGLE)) {
    const it = await C.findOne({ name: title(h), brand: "Mont" }); if (!it) { console.log("?? missing", h); continue; }
    const set = { weightGrams: d.w, ...(d.fill ? { attributes: { ...(it.attributes || {}), fillWeightG: d.fill } } : {}) };
    console.log(`SINGLE ${it.name.slice(0, 45).padEnd(45)} ${d.w}g${d.fill ? " (fill " + d.fill + ")" : ""}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set }); n++;
  }
  for (const [h, d] of Object.entries(PERVAR)) {
    const it = await C.findOne({ name: title(h), brand: "Mont" }); if (!it) { console.log("?? missing", h); continue; }
    const variants = (it.variants || []).map((v) => ({ key: v.key, options: v.options, ...(d.map[v.key] != null ? { weightGrams: d.map[v.key] } : {}) }));
    console.log(`PERVAR ${it.name.slice(0, 45).padEnd(45)} ${JSON.stringify(d.map)}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { variants, weightGrams: d.item } }); n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} items backfilled. Left null (no published weight): helios-jkt-women, take-a-break sit mat, warmlite-r2-2-sleeping-mat, mojo zip-off pants ×2.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
