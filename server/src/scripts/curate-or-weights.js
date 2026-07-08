/**
 * curate-or-weights.js — backfill weights for Outdoor Research apparel.
 *
 * The ingest drops weight when all size-variants share ONE weight (a guard meant for
 * configurable no-weight products). OR's feed does that for most apparel, so 87% came
 * in weightless. But OR's uniform weights are the garment's SHIPPING weight — fine for
 * LIGHT items (hat 88g, gloves 211g ≈ real; packaging negligible) but ~2× inflated for
 * jackets/parkas (Snowcrew Down listed 1151g vs ~570g real).
 *
 * So: fill weightGrams from the feed's uniform weight ONLY when ≤ THRESHOLD g (reliable
 * light items); leave heavier uniform items blank (shipping-inflated). Items whose feed
 * weight VARIES by size already kept real weights at ingest — untouched.
 *
 *   node src/scripts/curate-or-weights.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const THRESHOLD = 400; // g — above this a uniform weight is likely shipping (jackets)

function loadFeed() {
  const byName = {};
  for (const pg of [1, 2, 3, 4]) {
    try {
      const j = JSON.parse(fs.readFileSync(`/tmp/or${pg}.json`, "utf8"));
      for (const p of j.products || []) byName[p.title] = p;
    } catch (e) {}
  }
  return byName;
}

(async () => {
  const feed = loadFeed();
  if (!Object.keys(feed).length) { console.error("feed /tmp/or1-4.json missing — refetch products.json"); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: /outdoor research/i, isActive: true, $or: [{ weightGrams: null }, { weightGrams: { $exists: false } }] }).select("name").lean();

  const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  let filled = 0, skippedHeavy = 0, noFeed = 0, noG = 0;
  for (const it of items) {
    const p = feed[it.name];
    if (!p) { noFeed++; continue; }
    const gs = (p.variants || []).map((v) => v.grams).filter((x) => x > 0);
    if (!gs.length) { noG++; continue; }
    const w = median(gs); // uniform → the value; varying → representative middle size
    if (w > THRESHOLD) { skippedHeavy++; continue; } // shipping-inflated (jackets/parkas)
    if (COMMIT) await C.updateOne({ _id: it._id }, { $set: { weightGrams: w } });
    filled++;
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY"}: filled ${filled} (≤${THRESHOLD}g) | skipped ${skippedHeavy} heavy(shipping) | ${noFeed} not-in-feed | ${noG} no-feed-weight`);
  await mongoose.disconnect();
})();
