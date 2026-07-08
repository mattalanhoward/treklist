/**
 * curate-zpacks-attrs-longtail.js
 *
 * Attributes for the Zpacks long tail (clothing, cookware, insulation, gloves,
 * socks, hats, dry bags, singletons), derived from names + known Zpacks fabrics
 * (Titanium, Merino, Octa fleece, Vertice, 900FP down). Also retypes a few
 * mis-typed items and retypes pure-accessory cases/sleeves/holsters to "Other".
 * Genuine "Other" items + tiny hardware (cords/hooks) are left as-is.
 *
 *   node src/scripts/curate-zpacks-attrs-longtail.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const { categoryForItemType } = require("../config/inferItemType");

const g = (n) => /women/i.test(n) ? "Womens" : /men'?s\b/i.test(n) ? "Mens" : "Unisex";

// name -> itemType retypes (mis-typed)
const RETYPE = {
  "Zpacks Octa Fleece Camp Pants": "Hiking Pants",
  "Zpacks Octa Fleece Thermal Bottoms": "Base Layer Bottom",
  "Zpacks Micro-Fleece Hat": "Hat/Headwear",
  "Ultralight Sunglasses Case w/ Microfiber Cloth": "Other",
  "Ultralight Sunglasses Case": "Other",
  "Water Bottle Sleeve": "Other",
  "Trekking Pole Holsters (Both Sides of Pack)": "Other",
  "Trekking Pole Cup": "Other",
};

// name -> attributes (after any retype). Helpers fill gender from name.
const A = {
  // Backpacking Pot (Titanium, volume from name)
  "Toaks 1300ml Pot w/ Lid": { material: "Titanium", volumeMl: 1300 },
  "Toaks 900ml Wide D130 Pot w/ Lid": { material: "Titanium", volumeMl: 900 },
  "Toaks Light 650ml Cup w/ Lid": { material: "Titanium", volumeMl: 650 },
  "Toaks Light 700ml Pot w/ Lid": { material: "Titanium", volumeMl: 700 },
  "Evernew Titanium UL 400ml Cup": { material: "Titanium", volumeMl: 400 },
  "Evernew Titanium UL 570ml Cup": { material: "Titanium", volumeMl: 570 },
  // Hiking Shirt (gender + sleeveLength + material)
  "Zpacks Trail Cool Sun Hoody": { sleeveLength: "Long Sleeve", material: "Polyester" },
  "Women's Mirage Merino Sun Hoody": { sleeveLength: "Long Sleeve", material: "Merino Wool" },
  "The Mirage Merino Sun Hoody": { sleeveLength: "Long Sleeve", material: "Merino Wool" },
  "Zpacks Trail Cool T-Shirt": { sleeveLength: "Short Sleeve", material: "Polyester" },
  "Zpacks Radiant Wool T-Shirt": { sleeveLength: "Short Sleeve", material: "Merino Wool" },
  "Zpacks Crest T-Shirt": { sleeveLength: "Short Sleeve", material: "Cotton" },
  "Zpacks Merino Wool T-Shirt": { sleeveLength: "Short Sleeve", material: "Merino Wool" },
  "Zpacks x TownShirt Button Up Hiking Shirt": { sleeveLength: "Long Sleeve", material: "Nylon" },
  // Fleece Jacket (Octa = high-loft active fleece)
  "Zpacks Octa Fleece Hoody - Full Zip": { fleeceType: "High-Loft Fleece" },
  "Zpacks Octa Fleece Hoody - Pullover": { fleeceType: "High-Loft Fleece" },
  "Women's Octa Fleece Hoody - Full Zip": { fleeceType: "High-Loft Fleece" },
  "Women's Octa Fleece Hoody - Pullover": { fleeceType: "High-Loft Fleece" },
  // Insulated Jacket (900FP down)
  "Zpacks Down Hood": { insulationType: "Down", fillPower: 900 },
  "Zpacks Down Jacket": { insulationType: "Down", fillPower: 900 },
  // Rain Jacket / Rain Pants (Vertice = 2.5-layer waterproof-breathable)
  "Men's Vertice Rain Jacket": { layerCount: "2.5-Layer", mainFabric: "Vertice" },
  "Women's Vertice Rain Jacket": { layerCount: "2.5-Layer", mainFabric: "Vertice" },
  "Zpacks Ventum Wind Shell Jacket": { layerCount: "2.5-Layer", mainFabric: "Ventum wind shell" },
  "Vertice Rain Kilt": { layerCount: "2.5-Layer", mainFabric: "Vertice" },
  "DCF Rain Kilt": { layerCount: "2.5-Layer", mainFabric: "Dyneema Composite Fabric" },
  // Hiking Pants / Shorts (gender)
  "Zpacks Trail Cool Joggers": {},
  "Zpacks Octa Camp Pants": {},
  "Zpacks Octa Fleece Camp Pants": {},
  "Zpacks Travel & Trail Convertible Hiking Pants": {},
  "Zpacks Travel & Trail Hiking Pants": {},
  "Zpacks Trail Cool Hiking Shorts": {},
  // Base Layer Bottom (retyped)
  "Zpacks Octa Fleece Thermal Bottoms": { material: "Octa Fleece" },
  // Gloves (Insulated)
  "Fingerless Brushtail Possum Gloves": { gloveType: "Gloves (5-finger)", insulationType: "Wool" },
  "Conductive Brushtail Possum Gloves": { gloveType: "Gloves (5-finger)", insulationType: "Wool" },
  "Brushtail Possum Mittens": { gloveType: "Mittens", insulationType: "Wool" },
  "Vertice Rain Mitts": { gloveType: "Mittens", insulationType: "Uninsulated" },
  // Hiking Socks
  "Zpacks Trail Cool Socks": { sockType: "Hiking", material: "Synthetic" },
  "Brushtail Possum Socks": { sockType: "Hiking", material: "Wool Blend" },
  // Utensil / Pillow / Tent Stake / Trekking pole / Bear bag
  "Zpacks Titanium Trail Spoon": { utensilType: "Spoon", material: "Titanium" },
  "Comfy Camp Pillow": { pillowType: "Compressible" },
  "6\" Pachallama 2g Carbon-Pin Tent Stake": { soldAs: "Single", stakeMaterial: "Carbon Fiber" },
  "Carbon Fiber Staff": { material: "Carbon Fiber", soldAs: "Single" },
  "Adotec Grizzly Bear Resistant Bag - 14L": { capacityLiters: 14 },
  "Pack Liner": { material: "Cuben/DCF", closureType: "Roll-Top" },
  // Hats (hatType + material)
  "Brushtail Possum Beanie": { hatType: "Beanie/Winter Hat", material: "Wool Blend" },
  "Zpacks Micro-Fleece Hat": { hatType: "Beanie/Winter Hat", material: "Fleece" },
  "Zpacks Neck Gaiter": { hatType: "Buff/Neck Gaiter", material: "Synthetic" },
  "Zpacks Trail Trucker Hat": { hatType: "Baseball Cap", material: "Synthetic" },
  "Zpacks Foldable Trail Hat": { hatType: "Sun Hat", material: "Nylon" },
  // Dry Bags / Stuff Sacks (DCF)
  "Wide Mouth Dry Bag": { material: "Cuben/DCF", closureType: "Roll-Top", waterproof: true },
  "Dry Bag": { material: "Cuben/DCF", closureType: "Roll-Top", waterproof: true },
  "Medium Pillow Dry Bag": { material: "Cuben/DCF", closureType: "Roll-Top", waterproof: true },
  "Medium-Plus Pillow Dry Bag": { material: "Cuben/DCF", closureType: "Roll-Top", waterproof: true },
  "Stuff Sack": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Rock Stuff Sack": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Wallet Stuff Sack": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Cooking Pot Stuff Sack": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Stove Stuff Sack": { material: "Cuben/DCF", closureType: "Drawcord" },
  "Big Food Bag": { material: "Cuben/DCF", closureType: "Roll-Top" },
  "Large Food Bag": { material: "Cuben/DCF", closureType: "Roll-Top" },
  "Packing Cubes": { material: "Cuben/DCF", closureType: "Zip" },
};
// gendered itemTypes get gender auto-filled
const GENDERED = new Set(["Hiking Shirt", "Fleece Jacket", "Hiking Pants", "Hiking Shorts", "Insulated Jacket", "Rain Jacket", "Rain Pants", "Base Layer Bottom"]);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let retyped = 0, attributed = 0;

  for (const [name, it] of Object.entries(RETYPE)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! retype not found: ${name}`); continue; }
    doc.itemType = it;
    const { category, subcategory } = categoryForItemType(it, name);
    if (category) doc.category = category;
    if (subcategory) doc.subcategory = subcategory; else doc.subcategory = undefined;
    doc.$locals.lenientAttributes = true;
    if (COMMIT) await doc.save();
    retyped++;
  }

  for (const [name, attrs] of Object.entries(A)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! not found: ${name}`); continue; }
    const final = { ...attrs };
    if (GENDERED.has(doc.itemType) && !final.gender) final.gender = g(name);
    doc.attributes = final;
    doc.$locals.lenientAttributes = true;
    try { if (COMMIT) await doc.save(); attributed++; }
    catch (e) { console.log(`   !! ${name}: ${e.message}`); }
  }

  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: retyped ${retyped}, attributed ${attributed}/${Object.keys(A).length}`);
  await mongoose.disconnect();
})();
