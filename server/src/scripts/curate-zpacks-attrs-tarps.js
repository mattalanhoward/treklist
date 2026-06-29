/**
 * curate-zpacks-attrs-tarps.js — Zpacks Tarp Shelters + Ground Sheets (all DCF).
 * Ground sheets: material. Tarps: shape/material/dimensions/guyouts (dims from
 * the names, ft -> cm). Groundsheet Attachment Kit skipped (hardware, no fabric).
 *
 *   node src/scripts/curate-zpacks-attrs-tarps.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const DCF = "Dyneema Composite Fabric (DCF)";
const GROUNDSHEETS = ["Hexamid Bathtub Groundsheet", "Flat Groundsheet", "Groundsheet Poncho", "Bathtub Groundsheet", "Solo-Plus Bathtub Groundsheet", "Solo Bathtub Groundsheet"];
const TARPS = {
  "Big Ass Camp Tarp - 10' x 13'": { shape: "Rectangular", material: DCF, lengthCm: 396, widthCm: 305, coverageAreaSqM: 12.1 },
  "7' x 9' Flat Tarp": { shape: "Rectangular", material: DCF, lengthCm: 274, widthCm: 213, coverageAreaSqM: 5.8, guyoutPoints: 8 },
  "8.5' x 10' Flat Tarp": { shape: "Rectangular", material: DCF, lengthCm: 305, widthCm: 259, coverageAreaSqM: 7.9, guyoutPoints: 12 },
  "Hexamid Pocket Tarp": { shape: "Hex", material: DCF },
  "Hexamid Pocket Tarp w/ Doors DISC": { shape: "Hex", material: DCF },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const name of GROUNDSHEETS) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { material: "Cuben/DCF" };
    doc.$locals.lenientAttributes = true;
    console.log(`[Ground] ${name}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  for (const [name, attrs] of Object.entries(TARPS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { ...attrs };
    doc.$locals.lenientAttributes = true;
    console.log(`[Tarp]   ${name.padEnd(34)} ${attrs.shape}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/11  (Groundsheet Attachment Kit skipped — hardware)`);
  await mongoose.disconnect();
})();
