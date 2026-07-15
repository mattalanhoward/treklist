/**
 * fix-stove-types.js — stove itemType rework (user decision 2026-07-10):
 * "Backpacking Stove (Canister)" is renamed "Stove (Canister)" and split by fuel:
 * Stove (Canister) / Stove (Alcohol) / Stove (Wood) / Stove (Liquid Fuel)
 * (schema + classifier + client + i18n updated in the same change; prod rename is in
 * normalize-itemtypes.js ITEMTYPE_MAP for migration time).
 * Also: Vargo Sobata items are KNIVES (-> Pocket Knife) and Snow Peak Kuwagata is
 * archived (user call). updateOne only.
 *
 *   node src/scripts/fix-stove-types.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// exact-name overrides first (checked before the fuel rules)
const OVERRIDES = {
  "SOBATA-398": "Pocket Knife",
  "Sobata-815": "Pocket Knife",
  "Sobata-799": "Pocket Knife",
  "TRIAD MULTI-FUEL STOVE": "Stove (Alcohol)", // alcohol/esbit multi — alcohol is its identity
  "CONVERTER STOVE": "Stove (Alcohol)", // alcohol/fuel-tab insert for the Hexagon
  "TITANIUM FIRE BOX": "Stove (Wood)",
  // stove ACCESSORIES that were riding the /stove/ name rule
  "LowDown™ Remote Stove Adapter": "Other",
  "MSR® Piezo Igniter for Canister Stoves": "Other",
  "Trillium™ Stove Base": "Other",
  "GigaPower Windscreen": "Other",
  "TOAKS Titanium Portable Tripod": "Other",
  "TOAKS Portable Grill": "Other",
};
function fuelType(name) {
  const n = name.toLowerCase();
  if (/alcohol|spirit|decagon|trangia/.test(n)) return "Stove (Alcohol)";
  if (/wood|hexagon|firebox|fire box|twig|hobo/.test(n)) return "Stove (Wood)";
  if (/whisperlite|dragonfly|xgk|liquid fuel|white gas/.test(n)) return "Stove (Liquid Fuel)";
  return "Stove (Canister)";
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  const items = await C.find({ itemType: "Backpacking Stove (Canister)", isActive: true }).select("name brand").lean();
  console.log(`items typed "Backpacking Stove (Canister)": ${items.length}\n`);
  const counts = {};
  for (const it of items.sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name))) {
    const t = OVERRIDES[it.name] || fuelType(it.name);
    counts[t] = (counts[t] || 0) + 1;
    const { category, subcategory } = categoryForItemType(t, "");
    console.log(`  ${t.padEnd(22)} <- ${it.brand}: ${it.name.slice(0, 52)}`);
    if (COMMIT) {
      const set = { itemType: t };
      if (category) { set.category = category; set.subcategory = subcategory; }
      await C.collection.updateOne({ _id: it._id }, { $set: set });
    }
  }
  console.log(`\nby type: ${JSON.stringify(counts)}`);

  // Kuwagata -> archive (user, 2026-07-10)
  const ku = await C.findOne({ brand: "Snow Peak", name: "Kuwagata", isActive: true }).select("name").lean();
  if (ku) {
    console.log(`\narchive: Snow Peak Kuwagata`);
    if (COMMIT) await C.collection.updateOne({ _id: ku._id }, { $set: { isActive: false } });
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
