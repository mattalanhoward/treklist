/**
 * scrape-bd-weights.js — Black Diamond feed grams are a mix of true spec and inflated
 * shipping/placeholder values (review 2026-07-10 §R2-1.1: 4 of 6 spot-checks wrong 12-44%).
 * The PDP SPECS block renders server-side as:
 *   <li class="metafield-single_line_text_field">Weight: [AAA] 86 g, [BD1500] 72 g</li>
 * Found -> set weightGrams to the FIRST gram figure (primary/smallest config, matches how
 * the catalog already stores per-size items, e.g. Capitan S/M). Not found -> KEEP the feed
 * value (BD grams are right for many items; only overwrite with real evidence). updateOne only.
 *
 *   node src/scripts/scrape-bd-weights.js [--commit] [--limit N]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i > -1 ? parseInt(process.argv[i + 1]) : Infinity; })();
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

async function fetchPage(url) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 600 * (t + 1)));
  }
  return null;
}
function parseWeight(html) {
  const m = html.match(/metafield-single_line_text_field">\s*Weights?\s*:\s*([^<]{1,160})</i);
  if (!m) return null;
  const v = m[1].trim();
  let g = v.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (g) return { g: Math.round(parseFloat(g[1].replace(",", "."))), raw: v.slice(0, 60) };
  const kg = v.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (kg) return { g: Math.round(parseFloat(kg[1].replace(",", ".")) * 1000), raw: v.slice(0, 60) };
  const oz = v.match(/(\d+(?:\.\d+)?)\s*oz/i);
  if (oz) return { g: Math.round(parseFloat(oz[1]) * 28.35), raw: v.slice(0, 60) };
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const items = await C.find({ brand: "Black Diamond", isActive: true }).select("name weightGrams").lean();
  console.log(`active Black Diamond items: ${items.length}`);
  let set = 0, same = 0, nospec = 0, fail = 0, done = 0;
  for (const it of items) {
    if (done >= LIMIT) break;
    done++;
    const offer = await O.findOne({ productId: it._id, merchantId: /blackdiamond|direct-blackdiamond/ }).select("deepLink").lean()
      || await O.findOne({ productId: it._id, deepLink: /blackdiamondequipment\.com/ }).select("deepLink").lean();
    if (!offer) { console.log(`  !! no BD offer: ${it.name}`); fail++; continue; }
    const html = await fetchPage(offer.deepLink);
    if (!html) { console.log(`  !! fetch failed: ${it.name}`); fail++; continue; }
    const w = parseWeight(html);
    if (!w) { nospec++; continue; }
    if (w.g === it.weightGrams) { same++; continue; }
    console.log(`  ${it.name.slice(0, 46).padEnd(48)} ${String(it.weightGrams ?? "-").padStart(5)} -> ${String(w.g).padStart(5)}g   ("${w.raw}")`);
    set++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { weightGrams: w.g } });
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: changed ${set}, already-correct ${same}, no-spec-on-page ${nospec} (kept), failed ${fail} (of ${done})`);
  await mongoose.disconnect();
})();
