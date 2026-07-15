/**
 * fix-clothing-gender-category.js — same class of bug as footwear (see
 * fix-footwear-gender-subcat.js): importers cached a sibling's category, so some gendered
 * apparel landed in the wrong "<Gender> Clothing" category (women's jackets under Men's
 * Clothing, etc.). For clothing the CATEGORY carries gender (Men's/Women's/Unisex Clothing);
 * subcategory is the garment type and is left untouched. Resolve from the NAME prefix,
 * falling back to attributes.gender. updateOne only.
 *
 *   node src/scripts/fix-clothing-gender-category.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const CLOTHING_CATS = ["Men's Clothing", "Women's Clothing", "Unisex Clothing"];
function genderFromName(name) {
  if (/\bwomen'?s?\b/i.test(name)) return "Womens";
  if (/\bmen'?s?\b/i.test(name)) return "Mens";
  return null;
}
const catFor = (g) => (g === "Womens" ? "Women's Clothing" : g === "Mens" ? "Men's Clothing" : "Unisex Clothing");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ isActive: true, category: { $in: CLOTHING_CATS } }).select("name brand category subcategory attributes").lean();

  let fixed = 0, ok = 0;
  for (const it of items) {
    const nameG = genderFromName(it.name);
    const attrG = (it.attributes || {}).gender;
    // only act on a DEFINITE gender signal — never force a genderless item to Unisex
    // (would wrongly downgrade e.g. a Bra or genderless-named women's item).
    const gender = nameG || (attrG === "Mens" || attrG === "Womens" ? attrG : null);
    if (!gender) { ok++; continue; }
    const wantCat = catFor(gender);
    const set = {};
    if (it.category !== wantCat) set.category = wantCat;
    if (nameG && attrG !== nameG) set["attributes.gender"] = nameG;
    if (!set.category) { ok++; continue; }
    fixed++;
    console.log(`  [${gender}] "${it.category}" -> "${wantCat}"  (${it.subcategory})  ${it.brand}: ${it.name.slice(0, 44)}`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set });
  }
  console.log(`\nclothing items: ${items.length}; category fixed: ${fixed}; already ok: ${ok}`);
  console.log(COMMIT ? "APPLIED" : "DRY-RUN");
  await mongoose.disconnect();
})();
