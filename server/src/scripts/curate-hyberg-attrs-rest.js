/**
 * curate-hyberg-attrs-rest.js
 *
 * Fills attributes for the remaining Hyberg types (tents, tarps, dry/stuff bags,
 * hip packs, mug, spoon) from hyberg.de specs (hand-read). Also retypes the
 * mis-typed "Stake Bag" (it's a Dyneema stuff sack, NOT tent stakes) to
 * Dry Bag / Stuff Sack. PAKKID gets per-variant material (Dyneema / TX50 Ultra).
 *
 *   node src/scripts/curate-hyberg-attrs-rest.js            # dry-run
 *   node src/scripts/curate-hyberg-attrs-rest.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// itemType stays as-is unless in RETYPE
const RETYPE = { "Stake Bag": "Dry Bag / Stuff Sack" };

const ATTRS = {
  // Backpacking Tent
  "ExploMid I Ultralight Pyramid Tent":   { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", flyMaterial: "Silpoly PU4000", peakHeightCm: 150, doors: 1 },
  "ExploMid II  Ultralight Pyramid Tent": { capacity: "2-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall", flyMaterial: "Silpoly PU4000", peakHeightCm: 150, doors: 1 },
  "ExploMid Insert":                      { capacity: "1-Person", seasonRating: "3-Season", tentType: "Trekking Pole Tent", wallType: "Single Wall" },
  // Tarp Shelter
  "Zolo Easy Tarp": { shape: "Rectangular", material: "100% Polyester (20D Ripstop)", lengthCm: 275, widthCm: 145, coverageAreaSqM: 4.0 },
  "Zolo Max Tarp":  { shape: "Rectangular", material: "100% Polyester (20D Ripstop)", lengthCm: 290, widthCm: 275, coverageAreaSqM: 8.0 },
  "SKINI":          { shape: "Pyramid", material: "Silnylon PU3000", lengthCm: 255, widthCm: 105 },
  // Dry Bag / Stuff Sack
  "DRY BAG":      { volumeLiters: 8, closureType: "Roll-Top", material: "Dyneema® Composite Fabric", waterproof: true },
  "STUFF BAG":    { volumeLiters: 3, closureType: "Drawcord", material: "Dyneema® Composite Fabric" },
  "ZIP Bag":      { closureType: "Zip", material: "Challenge ECOPAK™ EPX200" },
  "ZIP BAG Lite": { closureType: "Zip", material: "Dyneema® Composite Fabric" },
  "PAKKID":       { volumeLiters: 6.5, closureType: "Drawcord", material: "Dyneema® Composite Fabric" },
  "Stake Bag":    { closureType: "Drawcord", material: "Dyneema® Composite Fabric" },
  // Hip Pack
  "RADA LITE": { waterResistant: true },
  "RADA Bag":  { waterResistant: true },
  // Coffee Mug / Utensil
  "Titanium Mug 550 ml": { volumeMl: 550, material: "Titanium" },
  "Titanium Spoon":      { utensilType: "Spoon", material: "Titanium" },
};

// PAKKID per-variant material by Material axis value
const PV = { "PAKKID": { Dyneema: "Dyneema® Composite Fabric", TX50Ultra: "TX50 Ultra™ Polyester" } };

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, attrs] of Object.entries(ATTRS)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^hyberg-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    if (RETYPE[name]) {
      doc.itemType = RETYPE[name];
      const { category, subcategory } = categoryForItemType(RETYPE[name], name);
      if (category) doc.category = category;
      if (subcategory) doc.subcategory = subcategory;
    }
    doc.attributes = { ...attrs };
    if (PV[name]) {
      for (const v of doc.variants) {
        const mat = v.options?.get?.("Material") ?? v.options?.Material;
        if (mat && PV[name][mat]) v.attributes = { ...(v.attributes || {}), material: PV[name][mat] };
      }
      doc.markModified("variants");
    }
    doc.$locals.lenientAttributes = true;
    console.log(`${(doc.itemType || "").slice(0,18).padEnd(19)} ${name.padEnd(36)} ${JSON.stringify(attrs)}${RETYPE[name] ? "  [RETYPED]" : ""}${PV[name] ? "  +per-variant" : ""}`);
    if (COMMIT) { try { await doc.save(); n++; } catch (e) { console.log("   !! " + e.message); } } else n++;
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(ATTRS).length}`);
  await mongoose.disconnect();
})();
