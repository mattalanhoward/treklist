/**
 * curate-osprey-sizes.js — consolidate manually-entered Osprey packs into one item
 * per model with a Size axis (per-variant weight + volumeLiters), reading each
 * size's existing weight. Reuses the smallest size as the parent; archives the rest.
 * Day-hiking lines (<40 L) = Daypack; overnight lines = Backpack.
 *
 *   node src/scripts/curate-osprey-sizes.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const MODELS = [
  { base: "Hikelite", type: "Daypack", gender: "Unisex", members: [["Hikelite 26", "26L"], ["Hikelite 28", "28L"], ["Hikelite 32", "32L"]] },
  { base: "Sirrus - Women's", type: "Daypack", gender: "Womens", members: [["Sirrus 24 - Women's", "24L"], ["Sirrus 34 - Women's", "34L"], ["Sirrus 36 - Women's", "36L"]] },
  { base: "Stratos - Men's", type: "Daypack", gender: "Mens", members: [["Stratos 24 - Men's", "24L"], ["Stratos 36 - Men's", "36L"]] },
  { base: "Talon Velocity - Men's", type: "Daypack", gender: "Mens", members: [["Talon Velocity 20 Men's", "20L"], ["Talon Velocity 30 Men's", "30L"]] },
  { base: "Talon - Men's", type: "Backpack", gender: "Mens", members: [["Talon 22 - Men's", "22L"], ["Talon 26 - Men's", "26L"], ["Talon 33 - Men's", "33L"], ["Talon 44 - Men's", "44L"]] },
  { base: "Tempest - Women's", type: "Backpack", gender: "Womens", members: [["Tempest 22 - Women's", "22L"], ["Tempest 26 - Women's", "26L"], ["Tempest 33 - Women's", "33L"], ["Tempest 44 Women's", "44L"]] },
  { base: "Kyte LT - Women's", type: "Backpack", gender: "Womens", members: [["Kyte LT 28 - Women's", "28L"], ["Kyte LT 35 - Women's", "35L"]] },
  { base: "Atmos AG - Men's", type: "Backpack", gender: "Mens", members: [["Atmos AG 50 - Men's", "50L"], ["Atmos AG 65 - Men's", "65L"]] },
  { base: "Atmos AG LT - Men's", type: "Backpack", gender: "Mens", members: [["Atmos AG LT 50 - Men's", "50L"], ["Atmos AG LT 65 - Men's", "65L"]] },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let consolidated = 0, archived = 0;
  for (const m of MODELS) {
    const docs = [];
    for (const [name, size] of m.members) {
      const d = await C.findOne({ name, brand: /osprey/i, isActive: true });
      if (!d) { console.log(`  ! ${m.base}: "${name}" not found`); continue; }
      docs.push({ d, size, vol: +size.replace(/\D/g, "") });
    }
    if (docs.length < 2) { console.log(`${m.base}: <2 sizes — skip`); continue; }
    const parent = docs[0].d;
    const variants = docs.map(({ d, size, vol }) => ({ key: size, options: { Size: size }, weightGrams: d.weightGrams, attributes: { volumeLiters: vol } }));
    console.log(`${m.base.padEnd(24)} ${m.type}  Size[${docs.map((x) => x.size).join("/")}] = ${docs.map((x) => x.d.weightGrams).join("/")}g`);
    if (COMMIT) {
      parent.name = m.base;
      parent.itemType = m.type;
      parent.variantAxes = [{ name: "Size", values: docs.map((x) => x.size) }];
      parent.variants = variants;
      parent.defaultVariantKey = docs[0].size;
      parent.weightGrams = docs[0].d.weightGrams;
      parent.attributes = { gender: m.gender, volumeLiters: docs[0].vol }; // clean (manual attrs may be invalid)
      parent.$locals.lenientAttributes = true;
      try { await parent.save(); } catch (e) { console.log(`   !! ${m.base}: ${e.message}`); continue; }
      consolidated++;
      for (let i = 1; i < docs.length; i++) { await C.updateOne({ _id: docs[i].d._id }, { $set: { isActive: false } }); archived++; }
    }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${consolidated} models consolidated, ${archived} archived`);
  await mongoose.disconnect();
})();
