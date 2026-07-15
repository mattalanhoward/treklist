/**
 * fix-katabatic-flex.js — Katabatic Flex quilt weights were wrong at the source (the brand
 * feed had the 40° matrix duplicating the 30°, and the user's spec sheet showed the real 40°
 * values are ~half of what the feed said). katabaticgear.com PDPs render the full SPECS
 * table server-side ("Total Weight (ounces)" row = 12 values: Small/Regular/Long +
 * Small-/Regular-/Long-Wide, each 850fp then 900fp) — verified identical to the user's
 * 2026-07-11 Flex 40 sheet. Scrape all five Flex temps and set per-variant + base weights.
 * updateOne only.
 *
 *   node src/scripts/fix-katabatic-flex.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// spec-table column order -> variant key
const COLS = [
  ['5\'6" / 850fp ExpeDRY Duck Down'], ['5\'6" / 900fp ExpeDRY Goose Down'],
  ["6' / 850fp ExpeDRY Duck Down"], ["6' / 900fp ExpeDRY Goose Down"],
  ['6\'6" / 850fp ExpeDRY Duck Down'], ['6\'6" / 900fp ExpeDRY Goose Down'],
  ['Wide 5\'6" / 850fp ExpeDRY Duck Down'], ['Wide 5\'6" / 900fp ExpeDRY Goose Down'],
  ["Wide 6' / 850fp ExpeDRY Duck Down"], ["Wide 6' / 900fp ExpeDRY Goose Down"],
  ['Wide 6\'6" / 850fp ExpeDRY Duck Down'], ['Wide 6\'6" / 900fp ExpeDRY Goose Down'],
].map((a) => a[0]);

async function fetchTotals(url) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } });
      if (r.ok) {
        const text = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        const m = text.match(/Total Weight \(ounces\)\s*((?:\d+\.\d+\s*){12})/i);
        if (m) return m[1].trim().split(/\s+/).map(parseFloat);
        return null;
      }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const items = await C.find({ brand: /katabatic/i, name: /^Flex/i, isActive: true }).select("name weightGrams defaultVariantKey variants").lean();

  for (const it of items) {
    const offer = await O.findOne({ productId: it._id }).select("deepLink").lean();
    const oz = await fetchTotals(offer.deepLink);
    if (!oz || oz.length !== 12) { console.log(`!! ${it.name}: no spec table parsed (${offer.deepLink})`); continue; }
    const byKey = {};
    COLS.forEach((k, i) => (byKey[k] = Math.round(oz[i] * 28.35)));
    const newVariants = (it.variants || []).map((v) => ({ ...v, weightGrams: byKey[v.key] ?? v.weightGrams }));
    const base = byKey[it.defaultVariantKey] ?? newVariants[0].weightGrams;
    console.log(`${it.name}: base ${it.weightGrams} -> ${base}g   (oz row: ${oz.join(" ")})`);
    (it.variants || []).forEach((v) => {
      if (byKey[v.key] !== v.weightGrams) console.log(`   ${v.key}: ${v.weightGrams} -> ${byKey[v.key]}g`);
    });
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { weightGrams: base, variants: newVariants } });
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
