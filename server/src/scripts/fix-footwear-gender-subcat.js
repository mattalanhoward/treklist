/**
 * fix-footwear-gender-subcat.js — recompute the gendered Footwear subcategory for every
 * footwear item. Bug: several importers (incl. reconcile-decathlon-batch3, and older Altra
 * imports) set category/subcategory from a cached sibling of the same itemType, so gendered
 * boots/shoes landed under "Unisex Footwear" (or no subcategory), and some women's items sat
 * under "Men's Footwear". Subcategory drives the Men's/Women's/Unisex Footwear filter chips.
 *
 * Correct subcategory = "<Gender> Footwear", resolved from the NAME prefix (Men's/Women's),
 * falling back to attributes.gender, else Unisex. Also backfills attributes.gender when the
 * name is unambiguous. updateOne only.
 *
 *   node src/scripts/fix-footwear-gender-subcat.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const FOOTWEAR_TYPES = ["Hiking Boots", "Hiking Shoes", "Trail Running Shoes", "Sandals", "Camp Shoes"];
function genderFromName(name) {
  const w = /\bwomen'?s?\b/i.test(name), m = /\bmen'?s?\b/i.test(name);
  if (w) return "Womens";                 // "women's" wins ("women" contains "men")
  if (m) return "Mens";
  return null;
}
const subFor = (g) => (g === "Womens" ? "Women's Footwear" : g === "Mens" ? "Men's Footwear" : "Unisex Footwear");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ isActive: true, $or: [{ category: "Footwear" }, { itemType: { $in: FOOTWEAR_TYPES } }] }).select("name brand itemType category subcategory attributes").lean();

  let fixedSub = 0, fixedGender = 0, ok = 0;
  for (const it of items) {
    const nameG = genderFromName(it.name);
    const attrG = (it.attributes || {}).gender;
    const gender = nameG || (attrG === "Mens" || attrG === "Womens" ? attrG : null) || "Unisex";
    const wantSub = subFor(gender);
    const set = {};
    if (it.category !== "Footwear") set.category = "Footwear";
    if (it.subcategory !== wantSub) set.subcategory = wantSub;
    // backfill/repair gender attr when the name is unambiguous
    if (nameG && attrG !== nameG) set["attributes.gender"] = nameG;
    if (!Object.keys(set).length) { ok++; continue; }
    if (set.subcategory) { fixedSub++; console.log(`  [${gender}] "${it.subcategory ?? "-"}" -> "${wantSub}"   ${it.brand}: ${it.name.slice(0, 46)}`); }
    if (set["attributes.gender"]) fixedGender++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set });
  }
  console.log(`\nfootwear items: ${items.length}; subcategory fixed: ${fixedSub}; gender-attr fixed: ${fixedGender}; already ok: ${ok}`);
  console.log(COMMIT ? "APPLIED" : "DRY-RUN");
  await mongoose.disconnect();
})();
