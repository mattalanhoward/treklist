/**
 * scrape-snowpeak-weights.js — replace Snow Peak's untrustworthy weights (Shopify
 * variant.grams = shipping weight; see catalog-review-2026-07-10.md §1.1) with the REAL
 * spec weight from each PDP, which renders server-side as:
 *   <div class="h4">Weight</div> <div> 4.8 oz (136 g) </div>
 * Found -> set weightGrams. Not found on the page -> UNSET (a missing weight is better
 * than a shipping weight). updateOne only.
 *
 *   node src/scripts/scrape-snowpeak-weights.js [--commit] [--limit N]
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
  // spec block: <div class="h4">Weight</div> <div> 4.8 oz (136 g) </div>
  const m = html.match(/class="h4">\s*Weight\s*<\/div>\s*<div>\s*([^<]{1,80})</i);
  if (!m) return null;
  const v = m[1].trim();
  let g = v.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*g\s*\)?/i);
  if (g) return { g: Math.round(parseFloat(g[1].replace(",", "."))), raw: v };
  const oz = v.match(/(\d+(?:\.\d+)?)\s*oz/i);
  if (oz) return { g: Math.round(parseFloat(oz[1]) * 28.35), raw: v };
  const lb = v.match(/(\d+(?:\.\d+)?)\s*lbs?/i);
  if (lb) return { g: Math.round(parseFloat(lb[1]) * 453.6), raw: v };
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const items = await C.find({ brand: "Snow Peak", isActive: true }).select("name weightGrams").lean();
  console.log(`active Snow Peak items: ${items.length}`);
  let set = 0, unset = 0, same = 0, fail = 0, done = 0;
  for (const it of items) {
    if (done >= LIMIT) break;
    done++;
    const offer = await O.findOne({ productId: it._id, merchantId: "direct-snowpeak" }).select("deepLink").lean();
    if (!offer) { console.log(`  !! no direct offer: ${it.name}`); fail++; continue; }
    const html = await fetchPage(offer.deepLink);
    if (!html) { console.log(`  !! fetch failed: ${it.name} ${offer.deepLink}`); fail++; continue; }
    const w = parseWeight(html);
    if (w) {
      if (w.g === it.weightGrams) { same++; }
      else {
        console.log(`  ${it.name.slice(0, 44).padEnd(46)} ${String(it.weightGrams ?? "-").padStart(5)} -> ${String(w.g).padStart(5)}g   ("${w.raw}")`);
        set++;
        if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { weightGrams: w.g } });
      }
    } else {
      console.log(`  ${it.name.slice(0, 44).padEnd(46)} ${String(it.weightGrams ?? "-").padStart(5)} -> null    (no Weight spec on PDP)`);
      unset++;
      if (COMMIT && it.weightGrams != null) await C.collection.updateOne({ _id: it._id }, { $unset: { weightGrams: 1 } });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: set ${set}, already-correct ${same}, nulled ${unset}, failed ${fail} (of ${done})`);
  await mongoose.disconnect();
})();
