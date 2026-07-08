/**
 * curate-weights-hyberg.js
 *
 * Hand-curated weights for Hyberg NO-WEIGHT items, extracted + VERIFIED from each
 * item's own description spec-table text (an AI extractor hallucinated earlier —
 * these were read by hand from the captured description). Only covers items whose
 * full spec table survived the 2000-char description cap; truncated/empty ones
 * (LONER Lite, SLUMBER, APEX synthetics, AER/ATTILA ULTRA/EGOIST/ARCON) still need
 * a brand-page lookup and are intentionally NOT touched here.
 *
 *   node src/scripts/curate-weights-hyberg.js            # dry-run
 *   node src/scripts/curate-weights-hyberg.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const COMMIT = process.argv.includes("--commit");

// Quilts: Size axis, weight = the headline bare-quilt "Weight" per size.
const SIZED = {
  "NIMBUS I Down Quilt":   { M: 425, L: 445, XL: 475 },
  "NIMBUS II Down Quilt":  { M: 530, L: 545, XL: 575 },
  "NIMBUS III Down Quilt": { M: 630, L: 645, XL: 675 },
  "NIMBUS IV Down Quilt":  { M: 730, L: 745, XL: 775 },
};

// Single published weight.
const SINGLE = {
  "ZEFYR": 385,
  "VALGUS Lite I Down sleeping Bag": 536,
  "RADA LITE": 71,
  "RADA Bag": 71,
  "Zolo Easy Tarp": 170,
  "Zolo Max Tarp": 340,
  "ExploMid I Ultralight Pyramid Tent": 420,
};

// Pack-attached pouches that escaped the accessory sweep (typed Hip Pack / Document).
const ARCHIVE = ["Hipbelt Pocket", "Shoulder Strap Pocket", "PILGER Lite"];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let sized = 0, single = 0, archived = 0;

  for (const [name, sizes] of Object.entries(SIZED)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    const order = ["M", "L", "XL"].filter((s) => sizes[s] != null);
    const variants = order.map((s) => ({ key: s, options: { Size: s }, weightGrams: sizes[s] }));
    console.log(`SIZED  ${name}  -> ${order.map((s) => `${s}:${sizes[s]}g`).join(" ")}  default=M`);
    if (COMMIT) {
      doc.variantAxes = [{ name: "Size", values: order }];
      doc.variants = variants;
      doc.defaultVariantKey = "M";
      doc.weightGrams = sizes.M;
      doc.$locals.lenientAttributes = true;
      await doc.save();
    }
    sized++;
  }

  for (const [name, g] of Object.entries(SINGLE)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    console.log(`SINGLE ${name}  -> ${g}g`);
    if (COMMIT) {
      doc.weightGrams = g;
      doc.$locals.lenientAttributes = true;
      await doc.save();
    }
    single++;
  }

  for (const name of ARCHIVE) {
    const r = await C.updateOne({ name, isActive: true, itemGroupId: /^hyberg-/ }, COMMIT ? { $set: { isActive: false } } : {});
    console.log(`ARCHIVE ${name}  ${r.matchedCount ? "(found)" : "!! not found"}`);
    if (r.matchedCount) archived++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: sized=${sized} single=${single} archived=${archived}`);
  await mongoose.disconnect();
})();
