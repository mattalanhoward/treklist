/**
 * curate-dandee.js — basic attributes for the kept Dandee Packs gear (cottage maker;
 * specs are imprecise / custom, weights mostly user-override). Junk already archived.
 *
 *   node src/scripts/curate-dandee.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const { categoryForItemType } = require("../config/inferItemType");

const A = {
  // packs
  "Standard Ultralight Backpack": { _type: "Backpack", _vol: ["20L", "27L", "35L"], volumeLiters: 27, gender: "Unisex", frameType: "Frameless", waterResistance: "Water Resistant" },
  "Sling Pack": { _type: "Hip Pack", _w: 42, volumeLiters: 4, waterResistant: true }, // 4L sling, too small for Daypack (min 10L)
  "Ultralight fanny pack": { volumeLiters: 1.7, waterResistant: true },
  // utensils
  "Folding Titanium Spoon": { utensilType: "Spoon", material: "Titanium", foldable: true },
  "Short Handled Bamboo Spoon": { utensilType: "Spoon", material: "Wood/Bamboo" },
  "Titanium Spoons": { utensilType: "Spoon", material: "Titanium" },
  "Classy Titanium Spoons 😉": { utensilType: "Spoon", material: "Titanium" },
  // tent stakes (Pachallama = carbon)
  "Pachallama 2g Tent Stakes": { soldAs: "Pack of 6", stakeMaterial: "Carbon Fiber" },
  "Ready to Ship, Stake Kit Sets": { soldAs: "Pack of 6", stakeMaterial: "Carbon Fiber" },
  // dry bags / stuff sacks
  "Ditty Bag": { closureType: "Drawcord" },
  "Itty Bitty Ditty Bag": { closureType: "Drawcord" },
  "Mini Ditty/Spoon Cover by Aardwolf": { closureType: "Drawcord" },
  "Bread Bags (Pair)": { closureType: "Roll-Top" },
  "Smell resistant zippered bags": { closureType: "Zip" },
  "Stuff Sack": { closureType: "Drawcord" },
  "T-Bone Stake Sacks": { closureType: "Drawcord" },
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let n = 0;
  for (const [name, raw] of Object.entries(A)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^dandeepacks-/ });
    if (!doc) { console.log(`!! ${name}`); continue; }
    const { _type, _vol, _w, ...attrs } = raw;
    if (_type) {
      doc.itemType = _type;
      const { category, subcategory } = categoryForItemType(_type, name);
      if (category) doc.category = category; if (subcategory) doc.subcategory = subcategory;
    }
    if (_w != null) doc.weightGrams = _w;
    if (_vol) {
      doc.variantAxes = [{ name: "Volume", values: _vol }];
      doc.variants = _vol.map((v) => ({ key: v, options: { Volume: v }, attributes: { volumeLiters: +v.replace("L", "") } }));
      doc.defaultVariantKey = _vol[1] || _vol[0];
    }
    doc.attributes = attrs;
    doc.$locals.lenientAttributes = true;
    try { if (COMMIT) await doc.save(); n++; console.log(`${name.slice(0,28).padEnd(29)} [${doc.itemType}] ${JSON.stringify(attrs)}`); }
    catch (e) { console.log(`   !! ${name}: ${e.message}`); }
  }
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${n}/${Object.keys(A).length}`);
  await mongoose.disconnect();
})();
