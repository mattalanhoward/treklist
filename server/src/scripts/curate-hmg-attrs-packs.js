/**
 * curate-hmg-attrs-packs.js — attributes for HMG packs (Backpack/Daypack).
 * Reliable attrs (volume/gender/frame/hipbelt/water/torso) for all; mainFabric only
 * where well-known (DCF classics vs Ultra expedition). Per-variant volumeLiters on
 * the Volume-axis packs. Daypack schema lacks mainFabric/torsoFitRange -> omitted.
 *
 *   node src/scripts/curate-hmg-attrs-packs.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const GRP = /^hyperlitemountaingear-/;
const DCF = "Dyneema Composite Fabric (DCF)", ULTRA = "UltraWeave (Ultra 200/400)";

// fab: mainFabric or null; frame: frameType; belt: hipBeltType
const PACKS = {
  // multi-volume (Volume axis) — frame/padded
  "Southwest": { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Windrider": { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Junction":  { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "NorthRim":  { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Ice Pack":  { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Unbound":   { fab: ULTRA, frame: "Internal Frame", belt: "Padded" },
  "Porter":    { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  // single-volume
  "Vertex 32":   { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Aspect 32":   { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Contour 35":  { fab: ULTRA, frame: "Internal Frame", belt: "Padded" },
  "Waypoint 35": { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Crux 40":     { fab: ULTRA, frame: "Internal Frame", belt: "Padded" },
  "Prism 40":    { fab: DCF, frame: "Internal Frame", belt: "Padded" },
  "Halka 55":    { fab: ULTRA, frame: "Internal Frame", belt: "Padded" },
  "Halka 70":    { fab: ULTRA, frame: "Internal Frame", belt: "Padded" },
  "Headwall 55": { fab: ULTRA, frame: "Internal Frame", belt: "Padded" },
  // small / frameless daypacks
  "Pemi 15":     { fab: DCF, frame: "Frameless", belt: "None" },
  "Daybreak 22": { fab: DCF, frame: "Frameless", belt: "None" },
  "Aero 28":     { fab: ULTRA, frame: "Frameless", belt: "None" },
  "Elevate 22":  { fab: ULTRA, frame: "Frameless", belt: "None" },
  "Stuff Pack 30": { fab: DCF, frame: "Frameless", belt: "None" },
  "Summit 30":   { fab: ULTRA, frame: "Frameless", belt: "None" },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, cfg] of Object.entries(PACKS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: GRP });
    if (!doc) { console.log(`!! ${name}`); continue; }
    const isDay = doc.itemType === "Daypack";
    // volume from Volume axis (multi) or from name (single)
    const volAxis = (doc.variantAxes || []).find((a) => a.name === "Volume");
    const baseVol = volAxis ? +String(volAxis.values[0]).replace(/\D/g, "") : +(name.match(/\d+/) || [doc.attributes?.volumeLiters || 0])[0];
    const attrs = { volumeLiters: baseVol, gender: "Unisex", frameType: cfg.frame, hipBeltType: cfg.belt, waterResistance: "Water Resistant" };
    if (!isDay) {
      if (cfg.fab) attrs.mainFabric = cfg.fab;
      attrs.hipBeltRemovable = true;
    }
    doc.attributes = attrs;
    if (volAxis) { // per-variant volumeLiters
      for (const v of doc.variants) {
        const vol = +String(v.options?.get?.("Volume") ?? v.options?.Volume ?? "").replace(/\D/g, "");
        if (vol) v.attributes = { ...(v.attributes || {}), volumeLiters: vol };
      }
      doc.markModified("variants");
    }
    doc.$locals.lenientAttributes = true;
    try { if (COMMIT) await doc.save(); n++; console.log(`${name.padEnd(14)} [${doc.itemType}] vol=${baseVol} ${cfg.frame} ${cfg.fab && !isDay ? cfg.fab.slice(0,4) : ""}`); }
    catch (e) { console.log(`   !! ${name}: ${e.message}`); }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(PACKS).length}`);
  await mongoose.disconnect();
})();
