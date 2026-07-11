/**
 * reclassify-other.js — move items out of the "Other" bucket into real itemTypes (8 new
 * types added 2026-07-10 + existing ones). Name-based rules, most-specific first. Items
 * that are genuinely miscellaneous accessories stay "Other". updateOne only.
 *
 *   node src/scripts/reclassify-other.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

function classify(name) {
  const n = name.toLowerCase();
  if (/sleeping pad|mattress|\bmat r0\d/.test(n)) return "Inflatable Sleeping Pad";
  if (/repeller|repellent/.test(n)) return "Insect Repellent";
  if (/air pump|inflator|schnozzel|pumpbag|pump bag|\bpump\b/.test(n)) return "Air Pump";
  if (/bivy|bivvy|bivybag|survival bag/.test(n)) return "Bivy Sack";
  if (/bootie|booty|down sock|camp slipper|camp shoe|camp boot\b|down slipper|warm booties|\bslippers?\b/.test(n)) return "Camp Shoes";
  if (/(waratah|feathertail)(?!.*(strap|spare))/.test(n)) return "Quilt"; // Neve Gear quilts mis-typed on import
  if (/microspike|micro spike|\bcleats?\b|traction|mudpons/.test(n)) return "Traction Device";
  if (/hammock/.test(n)) return "Hammock";
  if (/\bchair\b|\bstool\b/.test(n)) return "Camp Chair";
  if (/deuce of spades|trowel|dig dig|dig tool/.test(n)) return "Trowel";
  if (/hip ?belt pocket|hipbelt pocket|shoulder pouch|pole holster|pole holder|trekking pole cup|bottle sleeve|bottle holster/.test(n)) return "Pack Accessory";
  if (/innernet|inner net|inner tent|\bnest\b/.test(n)) return "Backpacking Tent";
  if (/pack cover|rain cover/.test(n)) return "Pack Liner";
  if (/sit pad|seat pad|sit-pad|foam seat/.test(n)) return "Sit Pad";
  return null; // stays "Other"
}
function genderOf(n) { return /women/i.test(n) ? "Womens" : /\bmen'?s\b/i.test(n) ? "Mens" : "Unisex"; }

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const items = await C.find({ isActive: true, itemType: "Other" }).select("name brand attributes").lean();

  let changed = 0; const kept = []; const byType = {};
  for (const it of items) {
    const t = classify(it.name);
    if (!t) { kept.push(`${it.brand}: ${it.name}`); continue; }
    const gender = genderOf(it.name);
    const { category, subcategory } = categoryForItemType(t, t === "Camp Shoes" ? (gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : "") : "");
    const set = { itemType: t };
    if (category) { set.category = category; set.subcategory = subcategory; }
    if (t === "Camp Shoes") set["attributes.gender"] = gender;
    byType[t] = (byType[t] || 0) + 1;
    console.log(`${t.padEnd(24)} <- ${it.brand}: ${it.name.slice(0, 40)}`);
    changed++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set });
  }
  console.log(`\nby new type:`, JSON.stringify(byType));
  console.log(`reclassified ${changed}, staying "Other": ${kept.length}`);
  console.log(`\nstaying "Other" (true misc):`);
  kept.forEach((k) => console.log("   " + k));
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
