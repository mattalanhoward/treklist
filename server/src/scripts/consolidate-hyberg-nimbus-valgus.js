/**
 * consolidate-hyberg-nimbus-valgus.js
 *
 * Folds the over-split NIMBUS quilts (I–IV, each Size M/L/XL) and VALGUS sleeping
 * bags (I/II/III, single size) into one variant parent each — same pattern as the
 * SLUMBER consolidation. NIMBUS → Fill × Size; VALGUS → Fill only. Per-Fill
 * variant attributes (tempRatingC, fillWeightG) baked in; parent offer repointed
 * to the line's collection page; other members + offers deleted (0 user refs).
 *
 *   node src/scripts/consolidate-hyberg-nimbus-valgus.js            # dry-run
 *   node src/scripts/consolidate-hyberg-nimbus-valgus.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const CLUSTERS = [
  {
    base: "NIMBUS Down Quilt", itemType: "Quilt",
    collection: "https://hyberg.de/collections/quilts",
    sizes: ["M", "L", "XL"], def: "II",
    baseAttrs: { insulationType: "Down", fillPower: 800, rdsDown: true, attachmentSystem: "Pad Straps", tempRatingC: 1 },
    fills: {
      "I":   { item: "NIMBUS I Down Quilt",   w: { M: 425, L: 445, XL: 475 }, attrs: { tempRatingC: 4, fillWeightG: 230 } },
      "II":  { item: "NIMBUS II Down Quilt",  w: { M: 530, L: 545, XL: 575 }, attrs: { tempRatingC: 1, fillWeightG: 330 } },
      "III": { item: "NIMBUS III Down Quilt", w: { M: 630, L: 645, XL: 675 }, attrs: { tempRatingC: -2, fillWeightG: 430 } },
      "IV":  { item: "NIMBUS IV Down Quilt",  w: { M: 730, L: 745, XL: 775 }, attrs: { tempRatingC: -5, fillWeightG: 530 } },
    },
  },
  {
    base: "VALGUS Down Sleeping Bag", itemType: "Sleeping Bag",
    collection: "https://hyberg.de/collections/valgus",
    sizes: null, def: "II",
    baseAttrs: { insulationType: "Down", fillPower: 800, shape: "Mummy", gender: "Unisex", rdsDown: true, tempRatingC: 3 },
    fills: {
      "I":   { item: "VALGUS Lite I Down sleeping Bag",   w: 536, attrs: { tempRatingC: 5, fillWeightG: 250 } },
      "II":  { item: "VALGUS Lite II Down Sleeping Bag",  w: 636, attrs: { tempRatingC: 3, fillWeightG: 350 } },
      "III": { item: "VALGUS Lite III Down Sleeping Bag", w: 736, attrs: { tempRatingC: 0, fillWeightG: 450 } },
    },
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem"), O = require("../models/merchantOffer");
  const GI = require("../models/globalItem"), GE = require("../models/gearItem");
  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"}\n`);

  for (const cl of CLUSTERS) {
    const fills = Object.entries(cl.fills);
    const docs = {};
    let ok = true;
    for (const [label, f] of fills) {
      docs[label] = await C.findOne({ name: f.item, isActive: true, itemGroupId: /^hyberg-/ }).select("_id").lean();
      if (!docs[label]) { console.log(`  ! ${cl.base}/${label}: "${f.item}" not found`); ok = false; }
    }
    if (!ok) { console.log(`${cl.base}: skip\n`); continue; }

    // build variants
    const variants = [];
    for (const [label, f] of fills) {
      if (cl.sizes) {
        for (const s of cl.sizes) if (f.w[s] != null)
          variants.push({ key: `${label} / ${s}`, options: { Fill: label, Size: s }, weightGrams: f.w[s], attributes: { ...f.attrs } });
      } else {
        variants.push({ key: label, options: { Fill: label }, weightGrams: f.w, attributes: { ...f.attrs } });
      }
    }
    const defKey = cl.sizes ? `${cl.def} / M` : cl.def;
    const defWeight = cl.sizes ? cl.fills[cl.def].w.M : cl.fills[cl.def].w;
    const axes = [{ name: "Fill", values: fills.map(([l]) => l) }];
    if (cl.sizes) axes.push({ name: "Size", values: cl.sizes });

    console.log(`${cl.base}  (${variants.length} variants, default ${defKey}=${defWeight}g, link ${cl.collection})`);
    fills.filter(([l]) => l !== cl.def).forEach(([, f]) => console.log(`    delete "${f.item}"`));

    if (COMMIT) {
      const p = await C.findById(docs[cl.def]._id);
      p.name = cl.base;
      p.variantAxes = axes;
      p.variants = variants;
      p.defaultVariantKey = defKey;
      p.weightGrams = defWeight;
      p.attributes = { ...cl.baseAttrs };
      p.$locals.lenientAttributes = true;
      await p.save();
      await O.updateMany({ productId: docs[cl.def]._id }, { $set: { deepLink: cl.collection } });
      for (const [label, f] of fills) {
        if (label === cl.def) continue;
        const id = docs[label]._id;
        const refs = (await GI.countDocuments({ productId: id })) + (await GE.countDocuments({ productId: id }));
        if (refs) { console.log(`    ⚠ keep "${f.item}" — ${refs} refs`); continue; }
        await O.deleteMany({ productId: id });
        await C.deleteOne({ _id: id });
      }
    }
    console.log("");
  }
  if (!COMMIT) console.log("(DRY RUN)");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
