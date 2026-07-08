/**
 * curate-atom.js — Atom Packs (5 items), specs from atompacks.co.uk.
 *  - The Atom: was a stray custom-build (1336 g, cpb-order link). Model as Volume
 *    variant 30/35/40 L (408/420/438 g base) + attrs; repoint offer to the builder.
 *  - The Nanu RE25: weight 600 -> 510 g + Daypack attrs.
 *  - The Roo RE: Hip Pack attrs + per-variant volume (variants already exist).
 *  - The Thinny: add Size variants S/M/L (87/116/145 g) + Foam Sleeping Pad attrs.
 *  - Pack Liner: material/closure attrs (variants already exist).
 *
 *   node src/scripts/curate-atom.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ATOM_LINK = "https://atompacks.co.uk/products/the-atom-custom";

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem"), O = require("../models/merchantOffer");
  const get = (n) => C.findOne({ name: n, isActive: true, itemGroupId: /^atompacks-/ });
  let n = 0;

  // The Atom — Volume variant
  let d = await get("The Atom");
  if (d) {
    d.attributes = { volumeLiters: 40, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant", mainFabric: "Challenge ECOPAK EPX200", loadCapacityKg: 9 };
    d.variantAxes = [{ name: "Volume", values: ["30L", "35L", "40L"] }];
    d.variants = [
      { key: "30L", options: { Volume: "30L" }, weightGrams: 408, attributes: { volumeLiters: 30 } },
      { key: "35L", options: { Volume: "35L" }, weightGrams: 420, attributes: { volumeLiters: 35 } },
      { key: "40L", options: { Volume: "40L" }, weightGrams: 438, attributes: { volumeLiters: 40 } },
    ];
    d.defaultVariantKey = "40L"; d.weightGrams = 438;
    d.$locals.lenientAttributes = true;
    console.log(`The Atom -> Volume[30/35/40L] 408/420/438g, frameless EPX200`);
    if (COMMIT) { await d.save(); await O.updateMany({ productId: d._id }, { $set: { deepLink: ATOM_LINK } }); }
    n++;
  } else console.log("!! The Atom");

  // The Nanu RE25 — weight fix + Daypack attrs
  d = await get("The Nanu RE25");
  if (d) {
    console.log(`The Nanu RE25: weight ${d.weightGrams} -> 510`);
    d.weightGrams = 510;
    d.attributes = { volumeLiters: 25, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant" };
    d.$locals.lenientAttributes = true;
    if (COMMIT) await d.save();
    n++;
  } else console.log("!! Nanu");

  // The Roo RE — Hip Pack attrs + per-variant volume
  d = await get("The Roo RE");
  if (d) {
    d.attributes = { volumeLiters: 1.5, waterResistant: true };
    for (const v of d.variants) {
      const big = /large|2\.5/i.test(v.key);
      v.attributes = { ...(v.attributes || {}), volumeLiters: big ? 2.5 : 1.5 };
    }
    d.markModified("variants");
    d.$locals.lenientAttributes = true;
    console.log(`The Roo RE -> Hip Pack 1.5/2.5L`);
    if (COMMIT) await d.save();
    n++;
  } else console.log("!! Roo");

  // The Thinny — Size variants + Foam Sleeping Pad attrs
  d = await get("The Thinny - 3mm (1/8 inch) Foam Sleeping Mat");
  if (d) {
    // 3mm = 0.3cm is below the schema's thicknessCm min (0.6), so it's omitted.
    d.attributes = { padType: "Closed-Cell Foam", bestUse: "Backpacking" };
    d.variantAxes = [{ name: "Size", values: ["S", "M", "L"] }];
    d.variants = [
      { key: "S", options: { Size: "S" }, weightGrams: 87 },
      { key: "M", options: { Size: "M" }, weightGrams: 116 },
      { key: "L", options: { Size: "L" }, weightGrams: 145 },
    ];
    d.defaultVariantKey = "M"; d.weightGrams = 116;
    d.$locals.lenientAttributes = true;
    console.log(`The Thinny -> Size[S/M/L] 87/116/145g`);
    if (COMMIT) await d.save();
    n++;
  } else console.log("!! Thinny");

  // Pack Liner — material/closure
  d = await get("Pack Liner");
  if (d) {
    d.attributes = { volumeLiters: 40, material: "D50T waterproof laminate", closureType: "Roll-Top" };
    d.$locals.lenientAttributes = true;
    console.log(`Pack Liner -> D50T, Roll-Top`);
    if (COMMIT) await d.save();
    n++;
  } else console.log("!! Pack Liner");

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/5`);
  await mongoose.disconnect();
})();
