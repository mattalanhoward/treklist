/**
 * fix-review-types.js — pre-existing itemType corrections from the 2026-07-10 whole-catalog
 * review (name-vs-type sweep; see server/reports/catalog-review-2026-07-10.md R2-SEV-2).
 * Also: Simond via-ferrata lanyard fix, Snow Peak Kuwagata (canister puncture tool) -> Other,
 * tent-inner convention unification (inserts -> Backpacking Tent, matching reclassify-other),
 * and Smartwool attributes.gender backfill from the name prefix. updateOne only.
 *
 *   node src/scripts/fix-review-types.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// [brand, exact name, newItemType]
const RETYPES = [
  ["Gossamer Gear", "Ultralight Backpacking Trowel", "Trowel"],
  ["Gossamer Gear", "Backpacking Pocket Knife", "Pocket Knife"],
  ["Gossamer Gear", "Static Backpack Compression Cord", "Other"],
  ["Gossamer Gear", "Trekking Pole Baskets", "Other"],
  ["Gossamer Gear", "Replacement Hiking Pole Tips", "Other"],
  ["Gossamer Gear", "Trekking Pole Rubber Boots", "Other"],
  ["Gossamer Gear", "Seam Grip SIL Silicone Tent Sealant", "Other"],
  ["Gossamer Gear", "The Crotch Pot", "Other"],
  ["Gossamer Gear", "Smart Water Bottle Upgrade Kit", "Other"],
  ["Vargo", "TITANIUM NAIL PEG - ULTRALIGHT", "Tent Stakes"],
  ["Vargo", "TITANIUM NAIL PEG", "Tent Stakes"],
  ["Vargo", "TITANIUM CREVICE STAKE", "Tent Stakes"],
  ["Vargo", "TRIAD MULTI-FUEL STOVE", "Backpacking Stove (Canister)"],
  ["Sea to Summit", "Hangout Mode Poleset", "Other"],
  ["Sea to Summit", "Ground Control Guy Cords - [4 Pack]", "Other"],
  ["Sea to Summit", "Telos Gear Loft", "Other"],
  ["Sea to Summit", "Alto Gear Loft", "Other"],
  ["Outdoor Research", "Crescent Fleece Beanie", "Hat/Headwear"],
  ["Outdoor Research", "Deviator Fleece Headband", "Hat/Headwear"],
  ["Outdoor Research", "Deviator Fleece Beanie", "Hat/Headwear"],
  ["Outdoor Research", "Grayland Fleece Beanie", "Hat/Headwear"],
  ["Outdoor Research", "Vigor Grid Fleece Beanie", "Hat/Headwear"],
  ["Outdoor Research", "Men's Tundra Trax Booties", "Camp Shoes"],
  ["Outdoor Research", "Women's Tundra Trax Booties", "Camp Shoes"],
  ["Outdoor Research", "Merino 150 Sensor Liners", "Gloves (Insulated)"],
  ["Zenbivy", "3D Inflation Sack", "Air Pump"],
  ["Zenbivy", "UL Inflation Sack", "Air Pump"],
  ["Zenbivy", "Mesh Storage Sack", "Dry Bag / Stuff Sack"],
  ["Arc'teryx", "Andessa Down Jacket Women's", "Insulated Jacket"],
  ["Arc'teryx", "Andessa Down Mid Jacket Women's", "Insulated Jacket"],
  ["Hyperlite Mountain Gear", "UltaMid 4 Mesh Insert, No Floor", "Backpacking Tent"],
  ["Hyperlite Mountain Gear", "UltaMid 4 Half Insert", "Backpacking Tent"],
  ["Hyperlite Mountain Gear", "UltaMid 4 Insert with Dyneema® Composite Fabric 1.3 Floor", "Backpacking Tent"],
  ["Hyperlite Mountain Gear", "UltaMid 2 Insert with Dyneema® Composite Fabric 1.3 Floor", "Backpacking Tent"],
  ["MSR", "Front Range™ Bug/Floor Insert", "Backpacking Tent"],
  ["Zpacks", "Zpacks Down Hood", "Hat/Headwear"],
  ["Exped", "Tarp Pole 240", "Other"],
  ["Atelier Longue Distance", "Sakasek", "Hip Pack"],
  ["Atelier Longue Distance", "Sakabouf", "Hip Pack"],
  ["Simond", "Double climbing and mountaineering lanyard", "Other"],
  ["Simond", "Climbing Single Lanyard 75 cm", "Other"],
  ["Snow Peak", "Kuwagata", "Other"],
  ["Snow Peak", "Deep Backpacker’s Cup with Lid", "Coffee Mug"],
];

const genderOf = (n) => (/women/i.test(n) ? "Womens" : /\bmen'?s\b|\bmens\b/i.test(n) ? "Mens" : "Unisex");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  console.log("== RETYPES ==");
  let changed = 0;
  for (const [brand, name, t] of RETYPES) {
    const it = await C.findOne({ brand, name, isActive: true }).select("itemType").lean();
    if (!it) { console.log(`  !! not found: ${brand}: ${name}`); continue; }
    if (it.itemType === t) { console.log(`  == already ${t}: ${brand}: ${name}`); continue; }
    const gender = genderOf(name);
    const needsGender = ["Camp Shoes", "Hat/Headwear", "Gloves (Insulated)", "Insulated Jacket"].includes(t);
    const { category, subcategory } = categoryForItemType(t, needsGender ? (gender === "Womens" ? "Women's" : gender === "Mens" ? "Men's" : "") : "");
    const set = { itemType: t };
    if (category) { set.category = category; set.subcategory = subcategory; }
    if (t === "Camp Shoes") set["attributes.gender"] = gender;
    console.log(`  ${brand}: ${name.slice(0, 52)}  ${it.itemType} -> ${t}${category ? `  [${category}/${subcategory}]` : ""}`);
    changed++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: set });
  }
  console.log(`  retyped: ${changed}`);

  console.log("\n== SMARTWOOL gender backfill ==");
  const sw = await C.find({ brand: "Smartwool", isActive: true, "attributes.gender": { $exists: false } }).select("name").lean();
  const counts = {};
  for (const it of sw) {
    const g = genderOf(it.name);
    counts[g] = (counts[g] || 0) + 1;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { "attributes.gender": g } });
  }
  console.log(`  backfilled ${sw.length}: ${JSON.stringify(counts)}`);

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
