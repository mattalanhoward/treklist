/**
 * backfill-ff-resold-weights.js — the Arc'teryx + Patagonia apparel imported from
 * FF's feed (create-ff-resold-apparel.js) went in weightless because the feed
 * variant `grams` are shipping weights. BUT the real garment weight IS in each
 * product's body_html — the last item of a features list, "X.X oz (NNN g)". This
 * pulls that value onto the catalog item + adds a reference-size disclaimer.
 *
 * ⚠ FF's copy states NO reference size (Arc/Pat quote a single spec weight, usually
 * men's M / women's S, but FF stripped the size label) — so the disclaimer is the
 * honest generic "manufacturer's reference-size weight; varies by size", NOT an
 * invented "size M". If we later import Arc/Pat DIRECT, their own pages do state the
 * size and would supersede this.
 *
 * updateOne only (never .save() on this model — pre-save hook wipes unselected fields).
 *
 *   node src/scripts/backfill-ff-resold-weights.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const FEED = "https://featheredfriends.com/products.json?limit=250";
const DISCLAIMER = "Listed weight is the manufacturer's reference-size weight; actual weight varies by size.";

function cleanName(title) {
  return title
    .replace(/\s+[FS]\d{2}\b/g, "")
    .replace(/\s*-\s*(closeout|sale|past season|discontinued|previous model).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function parseWeight(html) {
  const m = (html || "").match(/([\d.]+)\s*oz\s*\(\s*(\d[\d,]*)\s*g\s*\)/i);
  return m ? parseInt(m[2].replace(/,/g, "")) : null;
}

async function fetchAll() {
  const out = [];
  for (let page = 1; page <= 3; page++) {
    let json;
    for (let t = 0; t < 3 && !json; t++) {
      try {
        const res = await fetch(`${FEED}&page=${page}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) json = await res.json();
      } catch (e) { /* retry */ }
      if (!json) await new Promise((r) => setTimeout(r, 500));
    }
    if (!json || !json.products?.length) break;
    out.push(...json.products);
  }
  return out;
}

(async () => {
  const products = await fetchAll();
  const byName = {};
  for (const p of products) {
    if (!/^(Arc|Patagonia)/i.test(p.vendor || "")) continue;
    const n = cleanName(p.title);
    if (!(n in byName)) byName[n] = p.body_html; // first wins (season dupes share weight)
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: { $in: ["Arc'teryx", "Patagonia"] }, isActive: true }).select("name description weightGrams").lean();

  let set = 0, noWt = 0, already = 0;
  for (const it of items) {
    const body = byName[it.name];
    const w = body ? parseWeight(body) : null;
    if (!w) { noWt++; continue; }
    if (it.weightGrams === w && (it.description || "").includes("reference-size weight")) { already++; continue; }
    const desc = (it.description || "").replace(/\n\n\* Listed weight.*$/s, "").trim();
    const newDesc = desc + "\n\n* " + DISCLAIMER;
    console.log(`${it.name.slice(0, 44).padEnd(44)} -> ${w}g`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { weightGrams: w, description: newDesc } });
    set++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: set weight on ${set} | no-weight-in-desc ${noWt} | already ${already}`);
  await mongoose.disconnect();
})();
