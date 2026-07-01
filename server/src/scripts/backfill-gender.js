/**
 * backfill-gender.js — set the `gender` attribute (Mens/Womens) on every gendered
 * apparel/gear item catalog-wide, derived from the name. Also fixes category for
 * items mis-tagged "Unisex Clothing" because a CURLY apostrophe in "Men's/Women's"
 * (e.g. Katabatic) broke the gender regex in inferItemType (straight `'` worked, `’` didn't).
 *
 * Uses dotted `$set: {"attributes.gender": ...}` so it merges into existing attributes
 * without touching them (and without tripping the itemType+attributes update guard).
 *
 *   node src/scripts/backfill-gender.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// women FIRST ("women" contains "men"); apostrophe class covers straight ' and curly ’
const WOMEN = /\bwom[ae]n[’'`]?s?\b/i;
const MEN = /\bmen[’'`]?s?\b/i;
const genderOf = (name) => (WOMEN.test(name) ? "Womens" : MEN.test(name) ? "Mens" : null);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ isActive: true, name: /m[ae]n/i }).select("name itemType category attributes").lean();

  let setGender = 0, fixCat = 0, byBrand = {};
  const brandOf = {};
  for (const it of items) {
    const g = genderOf(it.name);
    if (!g) continue;
    const $set = {};
    const cur = (it.attributes && it.attributes.gender) || null;
    if (cur !== g) $set["attributes.gender"] = g;
    // fix "Unisex Clothing" mis-category (curly-apostrophe bug) → gendered clothing
    if (it.category === "Unisex Clothing") { $set.category = g === "Mens" ? "Men's Clothing" : "Women's Clothing"; fixCat++; }
    if (!Object.keys($set).length) continue;
    if ($set["attributes.gender"]) setGender++;
    if (COMMIT) await C.updateOne({ _id: it._id }, { $set });
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: set gender on ${setGender} items, fixed ${fixCat} "Unisex Clothing" → gendered category`);
  await mongoose.disconnect();
})();
