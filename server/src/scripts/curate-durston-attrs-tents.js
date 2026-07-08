/**
 * curate-durston-attrs-tents.js
 *
 * Fills Backpacking Tent attributes for the 8 Durston tents from durstongear.com
 * spec sheets (read via WebFetch, cross-checked). Per-variant material overrides:
 * X-Mid Pro floor by Floor axis (Woven=silnylon / Dyneema=DCF); X-Dome floor by
 * Interior axis + pole by Pole Set axis. X-Dome Pro 1+ is pre-release (minimal).
 *
 *   node src/scripts/curate-durston-attrs-tents.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const TENTS = {
  "X-Mid 1": { attrs: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Double Wall", poleMaterial: "Trekking Poles", flyMaterial: "15D Sil/PE Polyester (3500mm)", floorMaterial: "15D Sil/PE Nylon (3500mm)", peakHeightCm: 119, floorAreaSqM: 2.0, doors: 2, vestibules: 2 } },
  "X-Mid 2": { attrs: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Double Wall", poleMaterial: "Trekking Poles", flyMaterial: "15D Sil/PE Polyester (3500mm)", floorMaterial: "15D Sil/PE Nylon (3500mm)", peakHeightCm: 122, floorAreaSqM: 3.1, doors: 2, vestibules: 2 } },
  "X-Mid Pro 1": {
    attrs: { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Hybrid", poleMaterial: "Trekking Poles", flyMaterial: "Dyneema Composite Fabric 0.55", floorMaterial: "15D Silnylon", peakHeightCm: 114, floorAreaSqM: 1.9, doors: 2, vestibules: 2 },
    pv: (o) => ({ floorMaterial: o.Floor === "Dyneema" ? "Dyneema Composite Fabric 0.66" : "15D Silnylon" }),
  },
  "X-Mid Pro 2": {
    attrs: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Hybrid", poleMaterial: "Trekking Poles", flyMaterial: "Dyneema Composite Fabric 0.55", floorMaterial: "15D Silnylon", peakHeightCm: 117, floorAreaSqM: 2.7, vestibuleAreaSqM: 1.0, doors: 2, vestibules: 2 },
    pv: (o) => ({ floorMaterial: o.Floor === "Dyneema" ? "Dyneema Composite Fabric 0.66" : "15D Silnylon" }),
  },
  "X-Mid Pro 2+": {
    attrs: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Hybrid", poleMaterial: "Trekking Poles", flyMaterial: "Dyneema Composite Fabric 0.55", floorMaterial: "15D Silnylon", peakHeightCm: 124, floorAreaSqM: 3.0, vestibuleAreaSqM: 1.0, doors: 2, vestibules: 2 },
    pv: (o) => ({ floorMaterial: o.Floor === "Dyneema" ? "Dyneema Composite Fabric 0.66" : "15D Silnylon" }),
  },
  "X-Dome 1+": {
    attrs: { capacity: "1-Person", seasonRating: "3+ Season", tentType: "Freestanding", wallType: "Double Wall", poleMaterial: "Carbon Fiber", flyMaterial: "15D Sil/PE Poly (3500mm)", floorMaterial: "15D Sil/PE Nylon (3500mm)", peakHeightCm: 115, floorAreaSqM: 2.2, vestibuleAreaSqM: 0.85, doors: 1, vestibules: 1 },
    pv: (o) => ({ floorMaterial: o.Interior === "Solid" ? "20D Sil/PE Poly (3500mm)" : "15D Sil/PE Nylon (3500mm)", poleMaterial: o["Pole Set"] === "Aluminum" ? "Aluminum" : "Carbon Fiber" }),
  },
  "X-Dome 2": {
    attrs: { capacity: "2-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", poleMaterial: "Carbon Fiber", flyMaterial: "15D Sil/PE Poly (3500mm)", floorMaterial: "15D Sil/PE Woven (3500mm)", peakHeightCm: 110, floorAreaSqM: 3.0, vestibuleAreaSqM: 0.83, doors: 2, vestibules: 2 },
    pv: (o) => ({ floorMaterial: o.Interior === "Solid" ? "20D Sil/PE Poly (3500mm)" : "15D Sil/PE Woven (3500mm)", poleMaterial: o["Pole Set"] === "Aluminum" ? "Aluminum" : "Carbon Fiber" }),
  },
  "X-Dome Pro 1+": { attrs: { capacity: "1-Person", tentType: "Freestanding", poleMaterial: "Carbon Fiber", flyMaterial: "Dyneema Composite Fabric" } }, // pre-release
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, cfg] of Object.entries(TENTS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^durstongear-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    doc.attributes = { ...cfg.attrs };
    if (cfg.pv && Array.isArray(doc.variants) && doc.variants.length) {
      for (const v of doc.variants) {
        const o = {};
        (v.options?.forEach ? v.options : new Map(Object.entries(v.options || {}))).forEach((val, key) => { o[key] = val; });
        v.attributes = { ...(v.attributes || {}), ...cfg.pv(o) };
      }
      doc.markModified("variants");
    }
    doc.$locals.lenientAttributes = true;
    console.log(`${name.padEnd(14)} ${JSON.stringify(cfg.attrs)}${cfg.pv ? "  +per-variant" : ""}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(TENTS).length}`);
  await mongoose.disconnect();
})();
