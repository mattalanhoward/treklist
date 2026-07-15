/**
 * curate-flasks-and-junk.js — user curation (2026-07-15):
 *  - NEW "Flask" itemType (Kitchen & Cooking / Flasks). Retype the rigid titanium drink
 *    flasks (hip/wine/funnel) out of Hydration/Water Bottle into it. Soft collapsible WATER
 *    flasks (HydraPak SoftFlask, CNOC Hydriam) STAY in Hydration — they're hydration bottles.
 *  - Vargo BOT-700 + BOT HD were mis-typed Hydration Reservoir; they're Bottle Pots ->
 *    Backpacking Pot (Kitchen/Cookware), matching the other Vargo BOT items.
 *  - Archive 4 accessory/junk items.
 *  (HDPE Plastic Bottle left as-is pending a "storage" decision — no such itemType exists.)
 *  updateOne only; archive = isActive:false (reversible).
 *
 *   node src/scripts/curate-flasks-and-junk.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// rigid drink flasks -> Flask (explicit, so soft water flasks are never caught)
const DRINK_FLASKS = [
  ["Vargo", "TITANIUM FUNNEL FLASK"],
  ["Snow Peak", "Titanium Curved Flask"],
  ["Snow Peak", "Titanium Flask M"],
  ["Snow Peak", "Titanium Flask in 250 mL"],
  ["Snow Peak", "Round Titanium Flask in 150 mL"],
  ["TOAKS", "TOAKS Titanium Flat Flask Set"],
  ["TOAKS", "TOAKS Titanium Wine Flask"],
  ["TOAKS", /Wine Flask with Shot Glass/i],
];
const TO_POT = [["Vargo", "BOT - 700"], ["Vargo", "BOT HD"]];
const ARCHIVE = [
  ["Platypus", /big zip.*reservoir hanger/i],
  ["Platypus", /^hydration t-?shirt$/i],
  ["Platypus", /reservoir cleaning kit/i],
  ["TOAKS", /42ml shot glass/i],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const retype = async (brand, nameMatch, itemType, label) => {
    const q = typeof nameMatch === "string" ? { name: nameMatch } : { name: nameMatch };
    const it = await C.findOne({ brand, ...q, isActive: true }).select("name itemType category subcategory").lean();
    if (!it) { console.log(`  !! not found: ${brand} ${nameMatch}`); return; }
    const { category, subcategory } = categoryForItemType(itemType, "");
    console.log(`  ${label}: ${brand}: ${it.name.slice(0, 44)}  [${it.itemType} ${it.category}/${it.subcategory}] -> [${itemType} ${category}/${subcategory}]`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { itemType, category, subcategory } });
  };

  console.log("== RETYPE -> Flask (Kitchen/Flasks) ==");
  for (const [b, n] of DRINK_FLASKS) await retype(b, n, "Flask", "flask");
  console.log("\n== RETYPE Vargo BOT -> Backpacking Pot (Kitchen/Cookware) ==");
  for (const [b, n] of TO_POT) await retype(b, n, "Backpacking Pot", "pot");

  console.log("\n== ARCHIVE ==");
  let arch = 0;
  for (const [b, re] of ARCHIVE) {
    const it = await C.findOne({ brand: b, name: re, isActive: true }).select("name").lean();
    if (!it) { console.log(`  !! not found: ${b} ${re}`); continue; }
    console.log(`  archive: ${b}: ${it.name}`);
    arch++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { isActive: false } });
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${arch}`);
  await mongoose.disconnect();
})();
