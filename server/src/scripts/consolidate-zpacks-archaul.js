/**
 * consolidate-zpacks-archaul.js
 *
 * Groups the split Arc Haul Ultra packs into Men's + Women's variant items
 * (Volume × Fabric, UltraEPX folded as a Fabric option; EPX only valid at 60L).
 * Per-variant volumeLiters + mainFabric swap on selection. Weights are the site's
 * headline (representative) figure per config — user overrides for their build.
 * Also fills the remaining single-pack weights (Arc Zip Ultra M/W, Nero C/Pro).
 * Members archived (ref-safe); parent keeps its offer + base Backpack attributes.
 *
 *   node src/scripts/consolidate-zpacks-archaul.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const ULTRA = "Ultra 100X", EPX = "Ultra 100X / Ecopak EPX200";
const mkVariant = (vol, fab, w) => ({
  key: `${vol}L / ${fab === EPX ? "UltraEPX" : "Ultra 100X"}`,
  options: { Volume: `${vol}L`, Fabric: fab === EPX ? "UltraEPX" : "Ultra 100X" },
  weightGrams: w, attributes: { volumeLiters: vol, mainFabric: fab },
});

const GROUPS = [
  {
    base: "Arc Haul Ultra", parent: "Arc Haul Ultra 60L Backpack",
    archive: ["Arc Haul Ultra 40L Backpack", "Arc Haul Ultra 50L Backpack", "Arc Haul Ultra 70L Backpack", "Arc Haul UltraEPX 60L Backpack"],
    variants: [mkVariant(40, ULTRA, 620), mkVariant(50, ULTRA, 631), mkVariant(60, ULTRA, 642), mkVariant(70, ULTRA, 630), mkVariant(60, EPX, 641)],
    def: "60L / Ultra 100X", defW: 642,
  },
  {
    base: "Women's Arc Haul Ultra", parent: "Women's Arc Haul Ultra 60L Backpack",
    archive: ["Women's Arc Haul Ultra 40L Backpack", "Women's Arc Haul Ultra 50L Backpack", "Women's Arc Haul Ultra 70L Backpack", "Women's Arc Haul UltraEPX 60L Backpack"],
    variants: [mkVariant(40, ULTRA, 575), mkVariant(50, ULTRA, 586), mkVariant(60, ULTRA, 597), mkVariant(70, ULTRA, 608), mkVariant(60, EPX, 641)],
    def: "60L / Ultra 100X", defW: 597,
  },
];

const WEIGHT_FILL = {
  "Arc Zip Ultra 62L Backpack": 700,
  "Women's Arc Zip Ultra 62L Backpack": 678,
  "Nero Classic Backpack": 281,
  "Nero Pro Backpack": 315,
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  for (const g of GROUPS) {
    const p = await C.findOne({ name: g.parent, isActive: true, itemGroupId: /^zpacks-/ });
    if (!p) { console.log(`!! parent not found: ${g.parent}`); continue; }
    console.log(`${g.base.padEnd(24)} <- "${g.parent}"  ${g.variants.length} variants, def ${g.def}=${g.defW}g  (archive ${g.archive.length})`);
    if (COMMIT) {
      p.name = g.base;
      p.variantAxes = [{ name: "Volume", values: ["40L", "50L", "60L", "70L"] }, { name: "Fabric", values: ["Ultra 100X", "UltraEPX"] }];
      p.variants = g.variants;
      p.defaultVariantKey = g.def;
      p.weightGrams = g.defW;
      p.attributes = { ...p.attributes, volumeLiters: 60, mainFabric: "Ultra 100X" };
      p.$locals.lenientAttributes = true;
      await p.save();
      for (const name of g.archive) {
        const r = await C.updateOne({ name, isActive: true, itemGroupId: /^zpacks-/ }, { $set: { isActive: false } });
        if (!r.matchedCount) console.log(`   ? archive member not found: ${name}`);
      }
    }
  }

  for (const [name, w] of Object.entries(WEIGHT_FILL)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    console.log(`weight-fill ${name.padEnd(36)} ${doc.weightGrams ?? "-"} -> ${w}`);
    if (COMMIT) { doc.weightGrams = w; doc.$locals.lenientAttributes = true; await doc.save(); }
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
