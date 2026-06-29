/**
 * consolidate-hmg-halka.js — combine Halka 55 + Halka 70 into one "Halka" with
 * Volume × Torso variants (per-variant weight + volumeLiters), like the other
 * multi-volume HMG packs. Reuses Halka 55 as parent; archives Halka 70.
 *   node src/scripts/consolidate-hmg-halka.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const GRP = /^hyperlitemountaingear-/;

const TORSO = ["Small", "Medium", "Large", "Tall"];
const W = { "55L": [1208, 1238, 1276, 1292], "70L": [1401, 1428, 1461, 1483] };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const p = await C.findOne({ name: "Halka 55", isActive: true, itemGroupId: GRP });
  if (!p) { console.log("!! Halka 55 not found"); return; }
  const variants = [];
  for (const vol of ["55L", "70L"]) TORSO.forEach((t, i) =>
    variants.push({ key: `${vol} / ${t}`, options: { Volume: vol, "Torso Length": t }, weightGrams: W[vol][i], attributes: { volumeLiters: +vol.replace("L", "") } }));
  p.name = "Halka";
  p.variantAxes = [{ name: "Volume", values: ["55L", "70L"] }, { name: "Torso Length", values: TORSO }];
  p.variants = variants;
  p.defaultVariantKey = "55L / Small";
  p.weightGrams = 1208;
  p.attributes = { ...p.attributes, volumeLiters: 55 };
  p.$locals.lenientAttributes = true;
  console.log(`Halka -> Volume×Torso (${variants.length} variants), 1208–1483g`);
  if (COMMIT) {
    await p.save();
    const r = await C.updateOne({ name: "Halka 70", isActive: true, itemGroupId: GRP }, { $set: { isActive: false } });
    console.log(`archive Halka 70: ${r.matchedCount ? "ok" : "!!"}`);
  }
  console.log(COMMIT ? "APPLIED" : "DRY-RUN");
  await mongoose.disconnect();
})();
