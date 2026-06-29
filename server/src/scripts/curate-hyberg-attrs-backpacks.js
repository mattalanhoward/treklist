/**
 * curate-hyberg-attrs-backpacks.js
 *
 * Fills structured Backpack attributes (modelled on the hand-curated Bandit Lite)
 * from each item's hyberg.de spec table + description — read by hand, no AI.
 * Enums per attributeSchemas.js Backpack. Multi-material packs (EGOIST LITE,
 * ATTILA LITE) get per-variant `mainFabric` so it swaps with the Material axis.
 * AER PACK skipped (empty brand description — no data).
 *
 *   node src/scripts/curate-hyberg-attrs-backpacks.js            # dry-run (validates)
 *   node src/scripts/curate-hyberg-attrs-backpacks.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// base attributes per backpack (gender Unisex throughout)
const ATTRS = {
  "RINCO":  { volumeLiters: 18, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant", mainFabric: "X-Pac Polyester LiteSkin®", torsoFitRange: "40–65 cm" },
  "ZEFYR":  { volumeLiters: 18, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant", mainFabric: "X-Pac Polyester LiteSkin®", torsoFitRange: "40–65 cm" },
  "AGUILA": { volumeLiters: 37, gender: "Unisex", frameType: "Frameless", hipBeltType: "Webbing Only", waterResistance: "Water Resistant", mainFabric: "X-Pac VX-07", torsoFitRange: "45–65 cm" },
  "EGOIST": { volumeLiters: 40, gender: "Unisex", frameType: "Frameless", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "X-Pac VX-07", torsoFitRange: "43–55 cm" },
  "AGUILA LITE":        { volumeLiters: 37, gender: "Unisex", frameType: "Frameless", hipBeltType: "Webbing Only", waterResistance: "Water Resistant", mainFabric: "ALUULA Graflyte V-98®", torsoFitRange: "45–65 cm", hydrationCompatible: true },
  "EGOIST LITE":        { volumeLiters: 40, gender: "Unisex", frameType: "Frameless", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "ALUULA Graflyte™", torsoFitRange: "45–68 cm" },
  "ARCON":  { volumeLiters: 60, gender: "Unisex", frameType: "Internal Frame", hipBeltType: "Padded", hipBeltRemovable: true, waterResistance: "Water Resistant", mainFabric: "X-Pac VX-21", torsoFitRange: "43–58 cm" },
  "BANDIT": { volumeLiters: 40, gender: "Unisex", frameType: "Frameless", hipBeltType: "Webbing Only", waterResistance: "Water Resistant", mainFabric: "X-Pac VX-07", torsoFitRange: "45–65 cm" },
  "ATTILA": { volumeLiters: 48, gender: "Unisex", frameType: "Frameless", backPanelType: "Foam", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "X-Pac VX-07S", torsoFitRange: "38–58 cm", loadCapacityKg: 15, hydrationCompatible: true },
  "AGUILA LITE (2025)": { volumeLiters: 37, gender: "Unisex", frameType: "Frameless", hipBeltType: "Webbing Only", waterResistance: "Waterproof", mainFabric: "Dyneema® Composite Fabric Hybrid", torsoFitRange: "45–65 cm" },
  "EVENT":  { volumeLiters: 30, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant", mainFabric: "Ecopak EPX200®", torsoFitRange: "40–65 cm" },
  "ATTILA LITE": { volumeLiters: 48, gender: "Unisex", frameType: "Frameless", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "ALUULA Graflyte™", torsoFitRange: "38–58 cm", loadCapacityKg: 15 },
  "ATTILA ULTRA Ultralight backpack (2024 version)": { volumeLiters: 48, gender: "Unisex", frameType: "Frameless", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "ULTRA™ 100X (Ecopak EPL)", torsoFitRange: "38–58 cm", loadCapacityKg: 15, hydrationCompatible: true },
};

// per-variant mainFabric by Material value, for packs with a Material axis
const PER_VARIANT_FABRIC = {
  "EGOIST LITE": { ALUULA: "ALUULA Graflyte™", Dyneema: "Dyneema® Composite Fabric (DCF)" },
  "ATTILA LITE": { ALUULA: "ALUULA Graflyte™", Dyneema: "Dyneema® Composite Fabric", ULTRA: "ULTRA™ 100X" },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, attrs] of Object.entries(ATTRS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    doc.attributes = { ...attrs };
    // per-variant fabric override
    const pv = PER_VARIANT_FABRIC[name];
    if (pv) {
      for (const v of doc.variants) {
        const mat = v.options?.get?.("Material") ?? v.options?.Material;
        if (mat && pv[mat]) v.attributes = { ...(v.attributes || {}), mainFabric: pv[mat] };
      }
      doc.markModified("variants");
    }
    doc.$locals.lenientAttributes = true;
    console.log(`${name.slice(0, 30).padEnd(31)} ${JSON.stringify(attrs)}${pv ? "  +per-variant fabric" : ""}`);
    if (COMMIT) {
      try { await doc.save(); n++; }
      catch (e) { console.log(`   !! validation failed: ${e.message}`); }
    } else { n++; }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(ATTRS).length} (AER PACK skipped — no data)`);
  await mongoose.disconnect();
})();
