/**
 * curate-zpacks-attrs-sleep.js
 *
 * Zpacks Quilts + Sleeping Bags. All 900FP RDS down. The Temperature axis carries
 * the rating (e.g. "20F (-7C)") -> per-variant tempRatingC. Single-config
 * clearance/overstock bags get temp from their name. Archives the generic
 * "Sleeping Bags" collection-page leftover.
 *
 *   node src/scripts/curate-zpacks-attrs-sleep.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const tempC = (s) => { const m = String(s).match(/\((-?\d+)\s*C\)/); return m ? Number(m[1]) : null; };

// Quilts: base + per-variant temp via Temperature axis
const QUILTS = {
  "Solo Quilt": { tempRatingC: -7, footboxType: "Sewn Closed", attachmentSystem: "Pad Straps" },
  "Summer Quilt / Winter Liner": { tempRatingC: -1, footboxType: "Sewn Closed", attachmentSystem: "Pad Straps" },
  "20F (-7C) Twin Quilt": { tempRatingC: -7, footboxType: "Sewn Closed", attachmentSystem: "Pad Straps" },
};
// Sleeping bags: base + per-variant temp; shape per model
const BAGS = {
  "Classic Sleeping Bag": { tempRatingC: -7, shape: "Mummy" },
  "Mummy Sleeping Bag": { tempRatingC: -7, shape: "Mummy" },
  "Zip Around Sleeping Bag": { tempRatingC: -7, shape: "Semi-Rectangular" },
  "Clearance 30F Full Zip Sleeping Bag - Short-Slim - Green": { tempRatingC: -1, shape: "Mummy" },
  "OVERSTOCK - 30F Zip Around Sleeping Bag - Standard-Long-Black": { tempRatingC: -1, shape: "Semi-Rectangular" },
  "OVERSTOCK - 10F Zip Around Sleeping Bag - Standard-Long-Azure Blue": { tempRatingC: -12, shape: "Semi-Rectangular" },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;

  const applyPerVariantTemp = (doc) => {
    if (!(doc.variantAxes || []).some((a) => a.name === "Temperature")) return false;
    for (const v of doc.variants) {
      const o = {}; (v.options?.forEach ? v.options : new Map(Object.entries(v.options || {}))).forEach((val, k) => { o[k] = val; });
      const c = tempC(o.Temperature);
      if (c != null) v.attributes = { ...(v.attributes || {}), tempRatingC: c };
    }
    doc.markModified("variants");
    return true;
  };

  for (const [name, attrs] of Object.entries(QUILTS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { insulationType: "Down", fillPower: 900, rdsDown: true, ...attrs };
    const pv = applyPerVariantTemp(doc);
    doc.$locals.lenientAttributes = true;
    console.log(`[Quilt] ${name.slice(0, 30).padEnd(31)} base ${attrs.tempRatingC}C${pv ? "  +per-variant temp" : ""}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  for (const [name, attrs] of Object.entries(BAGS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = { insulationType: "Down", fillPower: 900, rdsDown: true, gender: "Unisex", ...attrs };
    const pv = applyPerVariantTemp(doc);
    doc.$locals.lenientAttributes = true;
    console.log(`[Bag]   ${name.slice(0, 30).padEnd(31)} ${attrs.shape} ${attrs.tempRatingC}C${pv ? "  +per-variant temp" : ""}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }

  // archive the generic collection-page leftover
  const r = await C.updateOne({ name: "Sleeping Bags", itemGroupId: /^zpacks-/, isActive: true }, COMMIT ? { $set: { isActive: false } } : {});
  console.log(`\narchive 'Sleeping Bags' (collection leftover): matched ${r.matchedCount}`);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/9`);
  await mongoose.disconnect();
})();
