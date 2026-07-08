/**
 * curate-zpacks-and-category.js
 *
 *  (1) Type the borderline-kept zpacks items that have a clear schema home.
 *  (2) Archive 6 mis-typed accessories (tent-pole sacks/sling, mesh pocket, pad
 *      strap, backpack belt) that were typed as Tent/Sleeping Bag/Backpack but are
 *      pack/tent add-ons — excluded per the accessory policy.
 *  (3) Catalog-wide: backfill category/subcategory for every active item that has a
 *      valid itemType (not Other) but no category — fixes items retyped earlier
 *      (category isn't auto-derived on save).
 *
 *   node src/scripts/curate-zpacks-and-category.js            # dry-run
 *   node src/scripts/curate-zpacks-and-category.js --commit
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");

const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const RETYPE = {
  "DupleXL DISC": "Backpacking Tent",
  "Carbon Fiber Staff": "Trekking Poles",
  "Large Food Bag": "Dry Bag / Stuff Sack",
  "Big Food Bag": "Dry Bag / Stuff Sack",
  "Adotec Grizzly Bear Resistant Bag - 14L": "Bear Canister",
  "Zpacks Down Hood": "Insulated Jacket",
  "Ultralight Titanium Whistle": "Other",
  "Foam Sit Pad": "Other",
};

const ARCHIVE = [
  "Tent Pole Sling (For 32\" Poles)", "Extra Large Tent Pole Sack", "Regular Tent Pole Sack",
  "Mesh Tent Pocket", "Sleeping Pad Strap", "Arc Backpack Belt",
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let retyped = 0, archived = 0, categorised = 0;

  for (const [name, itemType] of Object.entries(RETYPE)) {
    const doc = await C.findOne({ name, isActive: true, itemGroupId: /^zpacks-/ });
    if (!doc) { console.log(`!! retype not found: ${name}`); continue; }
    console.log(`RETYPE ${name} -> ${itemType}`);
    if (COMMIT) { doc.itemType = itemType; doc.$locals.lenientAttributes = true; await doc.save(); }
    retyped++;
  }

  for (const name of ARCHIVE) {
    const r = await C.updateOne({ name, isActive: true, itemGroupId: /^zpacks-/ }, COMMIT ? { $set: { isActive: false } } : {});
    console.log(`ARCHIVE ${name}  ${r.matchedCount ? "" : "!! not found"}`);
    if (r.matchedCount) archived++;
  }

  // category backfill (catalog-wide)
  const need = await C.find({
    isActive: true, itemType: { $nin: [null, "", "Other"] },
    $or: [{ category: { $in: [null, ""] } }, { category: { $exists: false } }],
  });
  for (const doc of need) {
    const { category, subcategory } = categoryForItemType(doc.itemType, doc.name);
    if (!category) { console.log(`  (no category map for ${doc.itemType}: ${doc.name})`); continue; }
    console.log(`CATEGORY ${doc.name}  [${doc.itemType}] -> ${category}${subcategory ? " / " + subcategory : ""}`);
    if (COMMIT) {
      doc.category = category;
      if (subcategory) doc.subcategory = subcategory;
      doc.$locals.lenientAttributes = true;
      await doc.save();
    }
    categorised++;
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: retyped=${retyped} archived=${archived} categorised=${categorised}`);
  await mongoose.disconnect();
})();
