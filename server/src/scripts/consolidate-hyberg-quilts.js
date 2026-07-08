/**
 * consolidate-hyberg-quilts.js
 *
 * Hyberg sells each quilt fill/temp as a SEPARATE product page, so the catalog
 * over-split them. This folds each line into ONE item with a Fill × Size variant
 * matrix (weights already hand-curated per size from the brand site). One member
 * is reused as the parent (renamed to the line's base name); its MerchantOffer is
 * repointed to the line's COLLECTION page (the offer model has no per-variant
 * link); the other members + their offers are deleted (only if unreferenced).
 *
 *   node src/scripts/consolidate-hyberg-quilts.js            # dry-run
 *   node src/scripts/consolidate-hyberg-quilts.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const DB = process.env.MONGO_DB_NAME;
if (COMMIT && DB !== "treklist_local") { console.error(`Refusing --commit to "${DB}".`); process.exit(1); }

// Each cluster: base name, axes, collection URL, default fill, and per-fill size→grams.
const CLUSTERS = [
  {
    base: "LONER Lite Down Quilt",
    collection: "https://hyberg.de/collections/loner-lite",
    def: "350",
    fills: {
      "250": { item: "LONER Lite 250 Down Quilt",  w: { M: 425, L: 445, XL: 475 } },
      "350": { item: "LONER Lite 350  Down Quilt", w: { M: 530, L: 545, XL: 575 } },
      "450": { item: "LONER Lite 450  Down Quilt", w: { M: 630, L: 645, XL: 675 } },
      "550": { item: "LONER Lite 550 Down Quilt",  w: { M: 730, L: 745, XL: 775 } },
    },
  },
  {
    base: "SLUMBER Down Quilt",
    collection: "https://hyberg.de/collections/quilts",
    def: "400",
    fills: {
      "300": { item: "SLUMBER 300 Down quilt", w: { M: 425, L: 465, XL: 490 } },
      "400": { item: "SLUMBER 400 Down quilt", w: { M: 535, L: 565, XL: 590 } },
      "500": { item: "SLUMBER 500 Down quilt", w: { M: 635, L: 665, XL: 690 } },
    },
  },
  {
    base: "LONER APEX Synthetic Quilt",
    collection: "https://hyberg.de/collections/loner-apex",
    def: "II",
    fills: {
      "I":   { item: "LONER APEX I Synthetic Quilt",   w: { M: 420, L: 440, XL: 460 } },
      "II":  { item: "LONER APEX II Synthetic Quilt",  w: { M: 540, L: 560, XL: 580 } },
      "III": { item: "LONER APEX III Synthetic Quilt", w: { M: 640, L: 660, XL: 680 } },
      "IV":  { item: "LONER APEX IV Synthetic Quilt",  w: { M: 680, L: 720, XL: 810 } },
    },
  },
  {
    base: "SLUMBER APEX Synthetic Quilt",
    collection: "https://hyberg.de/collections/climashield-apex",
    def: "III",
    fills: {
      "II":  { item: "SLUMBER APEX II Synthetic Quilt",  w: { L: 560, XL: 620 } },
      "III": { item: "SLUMBER APEX III Synthetic Quilt", w: { L: 660, XL: 680 } },
      "IV":  { item: "SLUMBER APEX IV Synthetic Quilt",  w: { L: 720, XL: 760 } },
    },
  },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem"), O = require("../models/merchantOffer");
  const GI = require("../models/globalItem"), GE = require("../models/gearItem");
  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"}  DB: ${mongoose.connection.name}\n`);

  for (const cl of CLUSTERS) {
    // resolve members
    const fills = Object.entries(cl.fills);
    const docs = {};
    let ok = true;
    for (const [label, f] of fills) {
      const it = await C.findOne({ name: f.item, isActive: true, itemGroupId: /^hyberg-/ }).select("_id name").lean();
      if (!it) { console.log(`  ! ${cl.base}/${label}: "${f.item}" not found`); ok = false; }
      docs[label] = it;
    }
    if (!ok) { console.log(`${cl.base}: missing members — skip\n`); continue; }

    const sizeOrder = ["S", "M", "L", "XL"];
    const sizesUsed = sizeOrder.filter((s) => fills.some(([, f]) => f.w[s] != null));
    const variants = [];
    for (const [label, f] of fills)
      for (const s of sizesUsed)
        if (f.w[s] != null) variants.push({ key: `${label} / ${s}`, options: { Fill: label, Size: s }, weightGrams: f.w[s] });

    const defSize = cl.fills[cl.def].w.M != null ? "M" : "L";
    const defKey = `${cl.def} / ${defSize}`;
    const defWeight = cl.fills[cl.def].w[defSize];
    const parentId = docs[cl.def]._id;

    console.log(`${cl.base}  (parent "${cl.fills[cl.def].item}", Fill×Size = ${variants.length} variants, default ${defKey}=${defWeight}g)`);
    console.log(`    fills: ${fills.map(([l]) => l).join(", ")}  | sizes: ${sizesUsed.join(", ")}  | link: ${cl.collection}`);
    fills.filter(([l]) => l !== cl.def).forEach(([l, f]) => console.log(`    delete "${f.item}"`));

    if (COMMIT) {
      const p = await C.findById(parentId);
      p.name = cl.base;
      p.variantAxes = [{ name: "Fill", values: fills.map(([l]) => l) }, { name: "Size", values: sizesUsed }];
      p.variants = variants;
      p.defaultVariantKey = defKey;
      p.weightGrams = defWeight;
      p.$locals.lenientAttributes = true;
      await p.save();
      // repoint parent offer(s) to collection page
      await O.updateMany({ productId: parentId }, { $set: { deepLink: cl.collection } });
      // remove the other members
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
  if (!COMMIT) console.log("(DRY RUN — re-run with --commit.)");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
