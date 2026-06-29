/**
 * fix-hyberg-weights.js
 *
 * Corrects pre-existing Hyberg weights that were WRONG (placeholder/guessed values
 * from the abandoned AI-extraction pass — user spot-check found EVENT/AGUILA/AGUILA
 * LITE wrong, an audit of all Hyberg items vs hyberg.de/products/<handle>.json found
 * ~13). All replacement values read by hand from each item's brand spec table.
 * Convention: packs = "Total" (as-shipped); sleeping bags = headline bag "Weight".
 *
 *   node src/scripts/fix-hyberg-weights.js            # dry-run
 *   node src/scripts/fix-hyberg-weights.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// single corrected weight (g)
const SINGLE = {
  "RINCO": 385,
  "AGUILA": 480,
  "AGUILA LITE": 380,
  "AGUILA LITE (2025)": 473,
  "BANDIT": 480,
  "SKINI": 290,
  "EVENT": 385,
  "VALGUS Lite II Down Sleeping Bag": 636,
  "VALGUS Lite III Down Sleeping Bag": 736,
  "ExploMid Insert": 290,
  "ExploMid II  Ultralight Pyramid Tent": 450,
};

// items that are actually multi-size -> Size variants (Total / Weight per size)
const SIZED = {
  "EGOIST": { axis: "Size", map: { M: 545, L: 560 }, def: "M" },
  "ZIP BAG Lite": { axis: "Size", map: { S: 13, M: 14, L: 17 }, def: "M" },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;

  for (const [name, g] of Object.entries(SINGLE)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    console.log(`${name}  ${doc.weightGrams}g -> ${g}g`);
    if (COMMIT) { doc.weightGrams = g; doc.$locals.lenientAttributes = true; await doc.save(); }
    n++;
  }

  for (const [name, cfg] of Object.entries(SIZED)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    const vals = Object.keys(cfg.map);
    console.log(`${name}  ${doc.weightGrams}g -> [${cfg.axis}] ${vals.map((v) => `${v}:${cfg.map[v]}`).join(" ")} def=${cfg.def}`);
    if (COMMIT) {
      doc.variantAxes = [{ name: cfg.axis, values: vals }];
      doc.variants = vals.map((v) => ({ key: v, options: { [cfg.axis]: v }, weightGrams: cfg.map[v] }));
      doc.defaultVariantKey = cfg.def;
      doc.weightGrams = cfg.map[cfg.def];
      doc.$locals.lenientAttributes = true;
      await doc.save();
    }
    n++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} items corrected`);
  await mongoose.disconnect();
})();
