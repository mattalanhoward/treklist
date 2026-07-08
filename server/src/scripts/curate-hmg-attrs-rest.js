/**
 * curate-hmg-attrs-rest.js — finish HMG: archive accessory/bundle clutter, attribute
 * HMG's own gear (quilts, stuff sacks, hip packs, stake kit, food bags). Third-party
 * reseller gear (MSR/Therm-a-Rest/Sawyer/etc.) keeps its auto-type (searchable +
 * buy-link); deep attrs are lower priority for resold items. UltaMid inserts/bivies
 * left as-is (components).
 *
 *   node src/scripts/curate-hmg-attrs-rest.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const GRP = /^hyperlitemountaingear-/;
const DCF = "Dyneema Composite Fabric (DCF)";

const ARCHIVE = ["Quilt Pad Straps", "Shoulder Pocket", "Wander Bundle", "Runabout Bundle", "Camera Pod", "1.4 UHMWPE Core Guy Line", "2.8 UHMWPE Core Guy Line", "Porter Water Bottle Holder - Nalgene®", "Porter Water Bottle Holder - 20 oz", "Zippy"];

const ATTRS = {
  "40-Degree Quilt": { insulationType: "Down", tempRatingC: 4, fillPower: 900, rdsDown: true },
  "20-Degree Quilt": { insulationType: "Down", tempRatingC: -7, fillPower: 900, rdsDown: true },
  "Drawstring Stuff Sacks": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Roll-Top Stuff Sacks": { material: "Cuben/DCF", closureType: "Roll-Top" },
  "Roll-Top Food Bag": { material: "Cuben/DCF", closureType: "Roll-Top" },
  "Stuff Sack Pillow": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Approach Duffel 30": { material: "Cuben/DCF", closureType: "Zip", volumeLiters: 30 },
  "Ultralight Tent Stake Kit": { soldAs: "Pack of 6", stakeMaterial: "Aluminum" },
  "Versa": { waterResistant: true },
  "Vice Versa": { waterResistant: true },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let arch = 0, attr = 0;
  for (const name of ARCHIVE) {
    const r = await C.updateOne({ name, isActive: true, itemGroupId: GRP }, COMMIT ? { $set: { isActive: false } } : {});
    if (r.matchedCount) arch++;
  }
  for (const [name, a] of Object.entries(ATTRS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: GRP });
    if (!doc) { console.log(`!! ${name}`); continue; }
    doc.attributes = a;
    doc.$locals.lenientAttributes = true;
    try { if (COMMIT) await doc.save(); attr++; }
    catch (e) { console.log(`   !! ${name}: ${e.message}`); }
  }
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${arch}/${ARCHIVE.length}, attributed ${attr}/${Object.keys(ATTRS).length}`);
  await mongoose.disconnect();
})();
