/**
 * curate-katabatic.js — post-ingest cleanup for Katabatic Gear (Shopify, quilts).
 * Feed is clean (Size×Fill quilt variants w/ real per-variant weights — no weight fix
 * needed). (1) archive noise (services/parts/resold care products/generic sacks);
 * (2) dedupe duplicate apparel listings (feed has old "Men's X" + new "X - Men's" for
 * the same jacket/windshell — keep the "- Men's/- Women's" suffix form, more colors);
 * (3) retype down hoods (AI said Quilt) → Hat/Headwear; (4) backfill categories.
 *
 *   node src/scripts/curate-katabatic.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

const ARCHIVE = [
  // services / parts / resold care products / generic accessories
  "Add Down to Used Katabatic Quilt", "Down Overfill",
  "Replacement Secondary Cord Clips", "Replacement Webbing Straps", "Replacement 2mm Cord",
  "Breathable Storage Bag", "Revivex Down Cleaner", "Seam Grip SIL Silicone Sealant",
  "Tenacious Tape Repair Tape", "Tenacious Tape Silnylon Patches", "Tenacious Tape Mesh Patches",
  "Silnylon Stuff Sack",
  // duplicate apparel listings (older "Men's/Women's X" form; keep "X - Men's/- Women's")
  "Men’s Tincup Down Jacket", "Women’s Tincup Down Jacket", "Women’s Tarn Down Jacket",
  "Men's Crest Windshell", "Women's Crest Windshell",
];

const RETYPE = {
  "Crestone Hood": "Hat/Headwear", // down hood = insulated headwear (was AI-typed Quilt)
  "Windom Hood": "Hat/Headwear",
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let archived = 0, retyped = 0, catFixed = 0;

  for (const name of ARCHIVE) {
    // curly vs straight apostrophes vary in the feed — escape regex specials first,
    // then make any apostrophe match either form.
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]");
    const rx = new RegExp("^" + esc + "$", "i");
    const d = await C.findOne({ name: rx, brand: /katabatic/i, isActive: true });
    if (!d) { console.log(`  ! archive: "${name}" not found/active`); continue; }
    console.log(`archive  ${d.name}`);
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { isActive: false } }); archived++; }
  }

  for (const [name, itemType] of Object.entries(RETYPE)) {
    const d = await C.findOne({ name, brand: /katabatic/i, isActive: true });
    if (!d) { console.log(`  ! retype: "${name}" not found`); continue; }
    console.log(`retype   ${name.padEnd(18)} ${d.itemType} → ${itemType}`);
    if (COMMIT) {
      const { category, subcategory } = categoryForItemType(itemType, name);
      await C.updateOne({ _id: d._id }, { $set: { itemType, category, subcategory } });
      retyped++;
    }
  }

  const needCat = await C.find({ brand: /katabatic/i, isActive: true, itemType: { $ne: null }, $or: [{ category: null }, { category: { $exists: false } }] }).select("name itemType").lean();
  for (const d of needCat) {
    const { category, subcategory } = categoryForItemType(d.itemType, d.name);
    if (!category) { console.log(`  ! no category for ${d.itemType} (${d.name})`); continue; }
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { category, subcategory } }); catFixed++; }
  }
  console.log(`\ncategory backfill: ${needCat.length} need it`);
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${COMMIT ? archived : ARCHIVE.length}, retyped ${COMMIT ? retyped : Object.keys(RETYPE).length}`);
  await mongoose.disconnect();
})();
