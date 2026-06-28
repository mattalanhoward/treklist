/**
 * consolidate-variants.js
 *
 * Collapses a set of sibling catalog items (each a size/temp/fill of ONE product
 * that the feed listed separately) into a single item with a variant selector.
 * Reuses one member as the parent (renamed to the base name) and removes the rest.
 *
 * Conservative: explicit per-cluster member lists (no fuzzy guessing). Each member
 * must be unreferenced (0 user refs) to be removed. DRY-RUN by default.
 *   node src/scripts/consolidate-variants.js
 *   node src/scripts/consolidate-variants.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : d; };
const COMMIT = args.includes("--commit");
const DB = flag("--db", null) || process.env.MONGO_DB_NAME;
const LOCAL_DBS = new Set(["treklist_local"]);
if (COMMIT && !LOCAL_DBS.has(DB) && flag("--confirm", null) !== DB) {
  console.error(`\nRefusing to --commit to non-local DB "${DB}".\n`); process.exit(1);
}

// Each cluster: base name, brand, axis, and ordered [regex, label] members.
// `def` = the label whose item becomes the surviving parent + default variant.
const CLUSTERS = [
  { base: "Adventure Medical Kit", brandLC: "adventure medical kits", axis: "Size", def: ".5",
    members: [[/^\.3 Medical Kit/i, ".3"], [/^\.5 Medical Kit/i, ".5"], [/^\.7 Medical Kit/i, ".7"], [/^\.9 Medical Kit/i, ".9"]] },
  { base: "Stuff Sack", brandLC: "zpacks", axis: "Size", def: "Medium",
    members: [[/^Mini Stuff Sack/i, "Mini"], [/^Small Stuff Sack/i, "Small"], [/^Small-Plus Stuff Sack/i, "Small-Plus"],
      [/^Slim Stuff Sack/i, "Slim"], [/^Medium Stuff Sack/i, "Medium"], [/^Medium-Plus Stuff Sack/i, "Medium-Plus"],
      [/^Large Stuff Sack/i, "Large"], [/^Big Stuff Sack/i, "Big"]] },
  { base: "Dry Bag", brandLC: "zpacks", axis: "Size", def: "Medium",
    members: [[/^Small Dry Bag/i, "Small"], [/^Slim Dry Bag/i, "Slim"], [/^Medium Dry Bag/i, "Medium"],
      [/^Tall Dry Bag/i, "Tall"], [/^Medium-Plus Dry Bag/i, "Medium-Plus"], [/^Big Dry Bag/i, "Big"],
      [/^Large Rectangle Dry Bag/i, "Large Rectangle"]] },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB });
  const C = require("../models/catalogItem"), O = require("../models/merchantOffer");
  const GI = require("../models/globalItem"), GE = require("../models/gearItem");
  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"}  DB: ${mongoose.connection.name}\n`);

  for (const cl of CLUSTERS) {
    // resolve each member to exactly one item
    const found = [];
    for (const [re, label] of cl.members) {
      const items = await C.find({ brandLC: cl.brandLC, name: re }).select("_id name weightGrams").lean();
      if (items.length === 1) found.push({ label, ...items[0] });
      else console.log(`  ! ${cl.base}/${label}: ${items.length} matches — skipped`);
    }
    if (found.length < 2) { console.log(`${cl.base}: <2 members resolved — skip\n`); continue; }

    const parent = found.find((f) => f.label === cl.def) || found[0];
    const variants = found.map((f) => ({ key: f.label, options: { [cl.axis]: f.label }, weightGrams: f.weightGrams }));
    const wd = parent.weightGrams;

    console.log(`${cl.base}  (parent: "${parent.name}", axis ${cl.axis}, ${found.length} variants, default ${parent.label}=${wd ?? "—"}g)`);
    found.forEach((f) => console.log(`    ${f.label.padEnd(14)} ${f.weightGrams ?? "—"}g   (${f.name})`));

    if (COMMIT) {
      const p = await C.findById(parent._id);
      p.name = cl.base;
      p.variantAxes = [{ name: cl.axis, values: found.map((f) => f.label) }];
      p.variants = variants;
      p.defaultVariantKey = parent.label;
      p.weightGrams = wd;
      p.$locals.lenientAttributes = true;
      await p.save();
      for (const f of found) {
        if (String(f._id) === String(parent._id)) continue;
        const refs = (await GI.countDocuments({ productId: f._id })) + (await GE.countDocuments({ productId: f._id }));
        if (refs) { console.log(`    ⚠ keep "${f.name}" — ${refs} refs`); continue; }
        await O.deleteMany({ productId: f._id });
        await C.deleteOne({ _id: f._id });
      }
    }
    console.log("");
  }
  if (!COMMIT) console.log("(DRY RUN — re-run with --commit.)");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
