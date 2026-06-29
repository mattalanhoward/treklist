/**
 * curate-atom-dimensions.js
 *
 * Adds a `dimensions` attribute (from atompacks.co.uk) to three Atom accessories.
 * Per-variant for The Thinny (S/M/L) and The Roo RE (Standard/Large) so the
 * dimensions swap with the size; single value for The Hipbelt Pocket.
 * `dimensions` is a freeform attribute key — it renders in the specs list with a
 * humanized "Dimensions" label, and variant attributes aren't schema-validated.
 *
 *   node src/scripts/curate-atom-dimensions.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const THINNY = { S: "99 × 48 cm", M: "150 × 48 cm", L: "199 × 48 cm" };
const ROO = { Standard: "20 × 13 × 6 cm", Large: "20 × 13 × 8.5 cm" };
const HIPBELT_POCKET = "17.8 × 10 × 5 cm";

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  // The Thinny — per-size dimensions
  let d = await C.findOne({ name: "The Thinny - 3mm (1/8 inch) Foam Sleeping Mat", isActive: true, brand: /atom/i });
  if (d) {
    for (const v of d.variants) {
      const size = v.options?.get?.("Size") ?? v.options?.Size;
      if (THINNY[size]) v.attributes = { ...(v.attributes || {}), dimensions: THINNY[size] };
    }
    d.markModified("variants");
    d.attributes = { ...(d.attributes || {}), dimensions: THINNY[d.defaultVariantKey] || THINNY.M };
    d.$locals.lenientAttributes = true;
    console.log(`The Thinny -> S/M/L dims ${JSON.stringify(THINNY)}`);
    if (COMMIT) await d.save();
  } else console.log("!! Thinny");

  // The Roo RE — per-size dimensions
  d = await C.findOne({ name: "The Roo RE", isActive: true, brand: /atom/i });
  if (d) {
    for (const v of d.variants) {
      const big = /large|2\.5/i.test(v.key);
      v.attributes = { ...(v.attributes || {}), dimensions: big ? ROO.Large : ROO.Standard };
    }
    d.markModified("variants");
    d.attributes = { ...(d.attributes || {}), dimensions: ROO.Standard };
    d.$locals.lenientAttributes = true;
    console.log(`The Roo RE -> Std ${ROO.Standard} / Large ${ROO.Large}`);
    if (COMMIT) await d.save();
  } else console.log("!! Roo");

  // The Hipbelt Pocket (itemType "Other") — single dimensions via updateOne (bypass validation)
  d = await C.findOne({ name: "The Hipbelt Pocket", isActive: true, brand: /atom/i }).select("_id attributes").lean();
  if (d) {
    console.log(`The Hipbelt Pocket -> ${HIPBELT_POCKET}`);
    if (COMMIT) await C.collection.updateOne({ _id: d._id }, { $set: { attributes: { ...(d.attributes || {}), dimensions: HIPBELT_POCKET } } });
  } else console.log("!! Hipbelt Pocket");

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
