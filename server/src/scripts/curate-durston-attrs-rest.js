/**
 * curate-durston-attrs-rest.js
 *
 * Durston packs (Wapta 30, Kakwa 40/55 — brand "Durston Gear", no itemGroupId),
 * Iceline Trekking Poles, and Groundsheets. Specs from durstongear.com (WebFetch,
 * cross-checked). Kakwa gets per-variant mainFabric (Ultra 200X / UltraGrid).
 * Iceline weight corrected 134 g (per pole) -> 268 g (the pair, as sold).
 *
 *   node src/scripts/curate-durston-attrs-rest.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const PACKS = {
  "Wapta 30": { attrs: { volumeLiters: 30, gender: "Unisex", frameType: "Frameless", hipBeltType: "Padded", hipBeltRemovable: true, waterResistance: "Water Resistant", mainFabric: "ALUULA Graflyte™ V-98", torsoFitRange: "38–55 cm", loadCapacityKg: 12 } },
  "Kakwa 40": {
    attrs: { volumeLiters: 40, gender: "Unisex", frameType: "Internal Frame", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "Ultra 200X", torsoFitRange: "37–55 cm", loadCapacityKg: 20, hydrationCompatible: true },
    pvFabric: { "Ultra 200X": "Ultra 200X (UHMWPE laminate)", "UltraGrid": "UltraGrid (210D nylon / UHMWPE)" },
  },
  "Kakwa 55": {
    attrs: { volumeLiters: 55, gender: "Unisex", frameType: "Internal Frame", hipBeltType: "Padded", waterResistance: "Water Resistant", mainFabric: "Ultra 200X", torsoFitRange: "38–56 cm", loadCapacityKg: 20, hydrationCompatible: true },
    pvFabric: { "Ultra 200X": "Ultra 200X (UHMWPE laminate)", "UltraGrid": "UltraGrid (210D nylon / UHMWPE)" },
  },
};

const POLES = { name: "Iceline Trekking Poles", weightGrams: 268, attrs: { material: "Carbon Fiber", soldAs: "Pair", minLengthCm: 95, maxLengthCm: 127, collapsedLengthCm: 49, sections: 3, gripMaterial: "EVA Foam", tipType: "Carbide", strapType: "Webbing", basketsIncluded: true } };
const GROUNDSHEET = { name: "Groundsheets", attrs: { material: "Polyester" } };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;

  for (const [name, cfg] of Object.entries(PACKS)) {
    const doc = await C.findOne({ name, isActive: true, brand: /durston/i });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { ...cfg.attrs };
    if (cfg.pvFabric) {
      for (const v of doc.variants) {
        const fab = v.options?.get?.("Fabric") ?? v.options?.Fabric;
        if (fab && cfg.pvFabric[fab]) v.attributes = { ...(v.attributes || {}), mainFabric: cfg.pvFabric[fab] };
      }
      doc.markModified("variants");
    }
    doc.$locals.lenientAttributes = true;
    console.log(`${name.padEnd(12)} ${JSON.stringify(cfg.attrs)}${cfg.pvFabric ? "  +per-variant fabric" : ""}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }

  for (const item of [POLES, GROUNDSHEET]) {
    const doc = await C.findOne({ name: item.name, isActive: true, brand: /durston/i });
    if (!doc) { console.log(`!! ${item.name}`); continue; }
    doc.attributes = { ...item.attrs };
    if (item.weightGrams) { console.log(`${item.name}: weight ${doc.weightGrams} -> ${item.weightGrams}`); doc.weightGrams = item.weightGrams; }
    doc.$locals.lenientAttributes = true;
    console.log(`${item.name.padEnd(12)} ${JSON.stringify(item.attrs)}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/5`);
  await mongoose.disconnect();
})();
