/**
 * curate-hmg-attrs-shelters.js — HMG tents/tarps/groundsheet attributes + archive
 * mis-typed pole accessories. UltaMid/Mid = DCF pyramid trekking-pole single-wall;
 * CrossPeak = silpoly double-wall trekking-pole; Unbound 2 = DCF semi-freestanding.
 *
 *   node src/scripts/curate-hmg-attrs-shelters.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const GRP = /^hyperlitemountaingear-/;
const DCF = "Dyneema Composite Fabric (DCF)";

const ARCHIVE = ["Carbon Fiber Tent Poles", "Tent Pole Jack"]; // pole accessories mis-typed as Tent

const TENTS = {
  "UltaMid 1": { capacity: "1-Person", seasonRating: "3+ Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles", flyMaterial: DCF },
  "UltaMid 2 – Ultralight Pyramid Tent": { capacity: "2-Person", seasonRating: "3+ Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles", flyMaterial: DCF },
  "UltaMid 4 – Ultralight Pyramid Tent": { capacity: "4-Person", seasonRating: "3+ Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles", flyMaterial: DCF },
  "Mid 1": { capacity: "1-Person", seasonRating: "3+ Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles", flyMaterial: DCF },
  "Unbound 2": { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", poleMaterial: "Trekking Poles", flyMaterial: DCF },
  "CrossPeak 1": { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Double Wall", poleMaterial: "Trekking Poles", flyMaterial: "Silpoly" },
  "CrossPeak 2": { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Double Wall", poleMaterial: "Trekking Poles", flyMaterial: "Silpoly" },
};
const OTHER = {
  "Flat Tarp": { _type: "Tarp Shelter", shape: "Rectangular", material: DCF },
  "Ground Cloth": { _type: "Ground Sheet", material: "Cuben/DCF" },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const name of ARCHIVE) {
    const r = await C.updateOne({ name, isActive: true, itemGroupId: GRP }, COMMIT ? { $set: { isActive: false } } : {});
    console.log(`archive ${name}: ${r.matchedCount ? "ok" : "!! not found"}`);
  }
  for (const [name, attrs] of Object.entries({ ...TENTS, ...OTHER })) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: GRP });
    if (!doc) { console.log(`!! ${name}`); continue; }
    const { _type, ...a } = attrs;
    if (_type) doc.itemType = _type;
    doc.attributes = a;
    doc.$locals.lenientAttributes = true;
    try { if (COMMIT) await doc.save(); n++; console.log(`${name.slice(0,30).padEnd(31)} ${a.capacity || a.shape || a.material}`); }
    catch (e) { console.log(`   !! ${name}: ${e.message}`); }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n} attributed`);
  await mongoose.disconnect();
})();
