/**
 * curate-hyberg-attrs-sleepingbags.js — VALGUS Lite I/II/III (hand-read hyberg.de).
 *   node src/scripts/curate-hyberg-attrs-sleepingbags.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const A = {
  "VALGUS Lite I Down sleeping Bag":   { insulationType: "Down", tempRatingC: 5, shape: "Mummy", gender: "Unisex", fillPower: 800, fillWeightG: 250, rdsDown: true },
  "VALGUS Lite II Down Sleeping Bag":  { insulationType: "Down", tempRatingC: 3, shape: "Mummy", gender: "Unisex", fillPower: 800, fillWeightG: 350, rdsDown: true },
  "VALGUS Lite III Down Sleeping Bag": { insulationType: "Down", tempRatingC: 0, shape: "Mummy", gender: "Unisex", fillPower: 800, fillWeightG: 450, rdsDown: true },
};
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem"); let n = 0;
  for (const [name, attrs] of Object.entries(A)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { ...attrs }; doc.$locals.lenientAttributes = true;
    console.log(`${name.padEnd(34)} ${JSON.stringify(attrs)}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("  !! " + e.message); } } else n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/3`);
  await mongoose.disconnect();
})();
