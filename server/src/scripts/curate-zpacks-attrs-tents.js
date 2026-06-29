/**
 * curate-zpacks-attrs-tents.js
 *
 * Backpacking Tent attributes for the Zpacks tents, from zpacks.com (WebFetch,
 * cross-checked) + name-derived capacity. All are single-wall DCF trekking-pole
 * shelters (Free Duo = freestanding double-wall). The "Material" axis = floor/
 * canopy DCF weight (Lite vs Standard) -> per-variant fly/floor material.
 * "Duplex Freestanding Flex Kit" is a conversion accessory (not a standalone tent)
 * -> skipped here; flagged for possible retype.
 *
 *   node src/scripts/curate-zpacks-attrs-tents.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const base = (capacity, extra = {}) => ({
  capacity, seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall",
  poleMaterial: "Trekking Poles", flyMaterial: "Dyneema Composite Fabric (DCF)", floorMaterial: "Dyneema Composite Fabric (DCF)", ...extra,
});

const TENTS = {
  "Plex Solo Pro Tent": base("1-Person", { peakHeightCm: 132, floorAreaSqM: 1.91, doors: 1, vestibules: 1 }),
  "Plex Solo Classic Tent": base("1-Person", { peakHeightCm: 132, floorAreaSqM: 1.91, doors: 1, vestibules: 1 }),
  "Altaplex Pro Tent": base("1-Person", { peakHeightCm: 152 }),
  "Altaplex Classic Tent": base("1-Person", { peakHeightCm: 152 }),
  "Duplex Classic Tent": base("2-Person", { peakHeightCm: 122, floorAreaSqM: 2.7, doors: 2, vestibules: 2 }),
  "Duplex Pro Tent": base("2-Person", { peakHeightCm: 122, floorAreaSqM: 2.7, doors: 2, vestibules: 2 }),
  "Duplex Lite Tent": base("2-Person", { peakHeightCm: 122, floorAreaSqM: 2.7, doors: 2, vestibules: 2 }),
  "Triplex Pro Tent": base("3-Person", { peakHeightCm: 122, floorAreaSqM: 3.6, doors: 2, vestibules: 2 }),
  "Pivot Solo Tent": base("1-Person"),
  "Pivot Duo Tent": base("2-Person", { peakHeightCm: 132, floorAreaSqM: 2.7, doors: 2, vestibules: 2 }),
  "Pivot Trio Tent": base("3-Person"),
  "DupleXL DISC": base("2-Person"),
  "Plexamid Tent DISC": base("1-Person"),
  "Hexamid Tent": base("1-Person"),
  "Free Duo Tent DISC": { capacity: "2-Person", seasonRating: "3-Season", tentType: "Freestanding", wallType: "Double Wall", poleMaterial: "Carbon Fiber", flyMaterial: "Dyneema Composite Fabric (DCF)", floorMaterial: "Dyneema Composite Fabric (DCF)" },
};

// per-variant fly/floor DCF weight, by the Material axis (Lite vs Standard floor)
function perVariant(optsMap) {
  const v = optsMap.Material || "";
  if (/standard/i.test(v)) return { flyMaterial: "0.75 oz DCF", floorMaterial: "1.0 oz DCF" };
  if (/lite/i.test(v)) return { flyMaterial: "0.55 oz DCF", floorMaterial: "0.75 oz DCF" };
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, attrs] of Object.entries(TENTS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    doc.attributes = { ...attrs };
    let pv = "";
    if ((doc.variantAxes || []).some((a) => a.name === "Material")) {
      for (const v of doc.variants) {
        const o = {}; (v.options?.forEach ? v.options : new Map(Object.entries(v.options || {}))).forEach((val, k) => { o[k] = val; });
        const ov = perVariant(o);
        if (ov) v.attributes = { ...(v.attributes || {}), ...ov };
      }
      doc.markModified("variants"); pv = "  +per-variant DCF";
    }
    doc.$locals.lenientAttributes = true;
    console.log(`${name.slice(0, 26).padEnd(27)} ${attrs.capacity} ${attrs.tentType}${pv}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(TENTS).length}  (Duplex Freestanding Flex Kit skipped — conversion accessory)`);
  await mongoose.disconnect();
})();
