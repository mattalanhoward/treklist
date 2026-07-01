/**
 * curate-cascade.js — post-ingest cleanup for the Cascade Designs family
 * (MSR / Therm-a-Rest / Platypus / SealLine / PackTowl, one Shopify store).
 * (1) REPLACE existing Amazon-linked items with the brand-direct versions (archive
 *     the Amazon ones — user OK'd; each logged); (2) archive 2 HMG-resold duplicates
 *     now the real brands are in; (3) archive "Other" noise (MSR = snowshoes + snow
 *     tools + replacement parts [out of a backpacking app's scope, no snowshoe type];
 *     TAR/Platypus = parts/accessories); (4) backfill categories.
 *
 * ⚠ REVIEW: this archives MSR's entire snowshoe line (~40, all typed "Other") — out
 *   of backpacking scope + no itemType. Reversible (isActive:false) if user wants them.
 *
 *   node src/scripts/curate-cascade.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

// Amazon-linked items superseded by the brand-direct import → archive the Amazon one.
const REPLACE_AMAZON = [
  { brand: "Therm-a-Rest", names: ["NeoAir Xlite NXT - RS", "NeoAir Xlite NXT - R", "NeoAir Xlite NXT - RW", "NeoAir Xlite NXT - L", "NeoAir XTherm NXT R", "NeoAir XTherm NXT RW", "NeoAir XTherm NXT L"], by: "NeoAir XLite/XTherm NXT Sleeping Pad (Size-variant)" },
  { brand: "MSR", names: ["Groundhog Tent Stakes", "Mini-Groundhog Tent Stakes", "PocketRocket 2"], by: "brand-direct Groundhog/Mini-Groundhog Stakes + PocketRocket 2 Stove" },
  { brand: "Platypus", names: ["Quickdraw"], by: "QuickDraw Filter (brand-direct)" },
];

// HMG-resold duplicates now the real brand is added
const HMG_DUPS = [
  "Therm-a-Rest NeoAir® XLite™ NXT Sleeping Pad",
  "Platypus Hoser 2.0L Reservoir",
];

const OTHER_ARCHIVE_BRANDS = ["MSR", "Therm-a-Rest", "Platypus"];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let replaced = 0, hmg = 0, otherArch = 0, catFixed = 0;
  const replacedLog = [];

  // 1) replace Amazon-linked
  for (const grp of REPLACE_AMAZON) {
    for (const name of grp.names) {
      const d = await C.findOne({ name, brand: grp.brand, isActive: true });
      if (!d) { console.log(`  ! replace: "${grp.brand} / ${name}" not found/active`); continue; }
      const amz = await O.countDocuments({ productId: d._id, network: "amazon" });
      console.log(`replace  [${grp.brand}] ${name}  (asin:${d.canonicalAsin || "-"}, amzOffers:${amz}) → ${grp.by}`);
      replacedLog.push(`${grp.brand} / ${name} (${d.canonicalAsin || "?"})`);
      if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { isActive: false } }); replaced++; }
    }
  }

  // 2) HMG-resold dups
  for (const name of HMG_DUPS) {
    const d = await C.findOne({ name, brand: /hyperlite/i, isActive: true });
    if (!d) { console.log(`  ! HMG dup: "${name}" not found`); continue; }
    console.log(`hmg-dup   ${name}`);
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { isActive: false } }); hmg++; }
  }

  // 3) archive "Other" noise
  for (const brand of OTHER_ARCHIVE_BRANDS) {
    const items = await C.find({ brand, isActive: true, itemType: "Other" }).select("_id name").lean();
    console.log(`\n${brand}: archiving ${items.length} "Other" (parts/accessories${brand === "MSR" ? "/snowshoes/snow tools" : ""})`);
    if (COMMIT && items.length) { await C.updateMany({ _id: { $in: items.map((i) => i._id) } }, { $set: { isActive: false } }); otherArch += items.length; }
  }

  // 4) backfill categories for typed active Cascade items
  const brands = ["MSR", "Therm-a-Rest", "Platypus", "SealLine", "PackTowl"];
  const needCat = await C.find({ brand: { $in: brands }, isActive: true, itemType: { $nin: [null, "Other"] }, $or: [{ category: null }, { category: { $exists: false } }] }).select("name itemType").lean();
  for (const d of needCat) {
    const { category, subcategory } = categoryForItemType(d.itemType, d.name);
    if (!category) continue;
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { category, subcategory } }); catFixed++; }
  }
  console.log(`\ncategory backfill: ${needCat.length} typed items need it`);

  console.log(`\n=== REPLACED (log) ===\n${replacedLog.join("\n")}`);
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: replaced ${COMMIT ? replaced : replacedLog.length}, hmg-dups ${hmg}, other-archived ${otherArch}, category ${catFixed}`);
  await mongoose.disconnect();
})();
