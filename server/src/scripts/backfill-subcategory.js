/**
 * backfill-subcategory.js — set the garment-type subcategory on apparel items that
 * lack one. The gendered category logic only attaches a subcategory to Men's/Women's
 * items; UNISEX clothing (Sam Bob, some OR) falls through with no subcategory. This
 * sets subcategory from CATEGORY_BY_ITEM_TYPE[itemType] regardless of gender.
 *
 *   node src/scripts/backfill-subcategory.js [--commit]   (default: Sam Bob + Outdoor Research)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { CATEGORY_BY_ITEM_TYPE } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const BRANDS = [/sam bob/i, /outdoor research/i];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ brand: { $in: BRANDS }, isActive: true, $or: [{ subcategory: null }, { subcategory: "" }, { subcategory: { $exists: false } }] }).select("name itemType category").lean();

  let set = 0, noMap = 0;
  const bySub = {};
  for (const it of items) {
    const entry = CATEGORY_BY_ITEM_TYPE[it.itemType];
    const sub = entry && entry[1];
    if (!sub) { noMap++; continue; }
    bySub[sub] = (bySub[sub] || 0) + 1;
    if (COMMIT) await C.updateOne({ _id: it._id }, { $set: { subcategory: sub } });
    set++;
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: set subcategory on ${set} items (${noMap} itemTypes with no subcategory map)`);
  console.log("  by subcategory:", Object.entries(bySub).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}:${c}`).join("  "));
  await mongoose.disconnect();
})();
