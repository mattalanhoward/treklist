/**
 * curate-zpacks-attrs-backpacks.js
 *
 * Backpack attributes for the 20 Zpacks packs, from zpacks.com spec pages
 * (WebFetch, cross-checked) + name-derived volume/gender. Arc packs = carbon Arc
 * Frame (Internal Frame), padded removable belt, Ultra 100X, ~18 kg; Nero/Bagger =
 * frameless, optional webbing belt, ~9 kg. Weights are intentionally left as-is
 * (configurable packs; user overrides).
 *
 *   node src/scripts/curate-zpacks-attrs-backpacks.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const arc = (volumeLiters, gender, mainFabric, extra = {}) => ({
  volumeLiters, gender, frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true,
  waterResistance: "Water Resistant", mainFabric, torsoFitRange: "16–26 in (41–66 cm)", hydrationCompatible: true, ...extra,
});
const nero = (volumeLiters, gender, mainFabric, extra = {}) => ({
  volumeLiters, gender, frameType: "Frameless", hipBeltType: "Webbing Only", hipBeltRemovable: true,
  waterResistance: "Water Resistant", mainFabric, torsoFitRange: "18–22 in (46–56 cm)", loadCapacityKg: 9, hydrationCompatible: true, ...extra,
});

const ATTRS = {
  // Arc Haul Ultra (carbon frame, Ultra 100X, 18 kg)
  "Arc Haul Ultra 40L Backpack": arc(40, "Unisex", "Ultra 100X", { loadCapacityKg: 18 }),
  "Arc Haul Ultra 50L Backpack": arc(50, "Unisex", "Ultra 100X", { loadCapacityKg: 18 }),
  "Arc Haul Ultra 60L Backpack": arc(60, "Unisex", "Ultra 100X", { loadCapacityKg: 18 }),
  "Arc Haul Ultra 70L Backpack": arc(70, "Unisex", "Ultra 100X", { loadCapacityKg: 18 }),
  "Women's Arc Haul Ultra 40L Backpack": arc(40, "Womens", "Ultra 100X", { loadCapacityKg: 18 }),
  "Women's Arc Haul Ultra 50L Backpack": arc(50, "Womens", "Ultra 100X", { loadCapacityKg: 18 }),
  "Women's Arc Haul Ultra 60L Backpack": arc(60, "Womens", "Ultra 100X", { loadCapacityKg: 18 }),
  "Women's Arc Haul Ultra 70L Backpack": arc(70, "Womens", "Ultra 100X", { loadCapacityKg: 18 }),
  "Arc Haul UltraEPX 60L Backpack": arc(60, "Unisex", "Ultra 100X / Ecopak EPX200", { loadCapacityKg: 18 }),
  "Women's Arc Haul UltraEPX 60L Backpack": arc(60, "Womens", "Ultra 100X / Ecopak EPX200", { loadCapacityKg: 18 }),
  "Arc Zip Ultra 62L Backpack": arc(62, "Unisex", "Ultra 100X", { loadCapacityKg: 18 }),
  "Women's Arc Zip Ultra 62L Backpack": arc(62, "Womens", "Ultra 100X", { loadCapacityKg: 18 }),
  // discontinued Arc packs (framed; fabric from model)
  "Arc Haul Scout 50L Backpack DISC": arc(50, "Unisex", "Gridstop Nylon"),
  "Arc Blast 55L Backpack DISC": arc(55, "Unisex", "Dyneema Composite Fabric"),
  "Arc Air DCF 50L Backpack DISC": arc(50, "Unisex", "Dyneema Composite Fabric"),
  "Arc Zip 57L Backpack DISC": arc(57, "Unisex", "Dyneema Composite Fabric"),
  // frameless
  "Nero Classic Backpack": nero(40, "Unisex", "Ultra 100X"),
  "Nero Pro Backpack": nero(40, "Unisex", "Ultra TenX / Ultra 100X"),
  "Super Nero Ultra 50L Backpack": nero(50, "Unisex", "Ultra 100X"),
  "Bagger Ultra 25L Backpack": nero(25, "Unisex", "Ultra 100X", { torsoFitRange: "~18 in (46 cm)" }),
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, attrs] of Object.entries(ATTRS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    doc.attributes = { ...attrs };
    doc.$locals.lenientAttributes = true;
    console.log(`${name.slice(0, 38).padEnd(39)} vol=${attrs.volumeLiters} ${attrs.frameType} ${attrs.mainFabric}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(ATTRS).length}`);
  await mongoose.disconnect();
})();
