/**
 * archive-accessory-junk.js — archive replacement-part / consumable / spare accessories that
 * clutter a gear-planning catalog (user, 2026-07-11). Water-filter cartridges & maintenance
 * kits, replacement reservoirs/lids, spare cords/straps/tips. Done in LOCAL now so the archive
 * state carries through the prod archive-and-readd migration (removing on prod post-live would
 * be lost). Explicit name list — keeps real standalone products (e.g. DayCap In-Bottle Filter).
 * Also adds the standard Nemo Moonlite Reclining Camp Chair (907g / 2 lb; the Elite = 544g).
 * Archive = isActive:false (reversible). updateOne / create only.
 *
 *   node src/scripts/archive-accessory-junk.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }
const ADMIN_ID = "6a213efbc50ff0a814869c8d";

// explicit [brand, exact-ish name regex] of accessory junk to archive
const JUNK = [
  ["Platypus", /^DayCap.{0,3} Replacement Filter$/i],
  ["MSR", /Guardian.{0,3} Gravity Purifier Replacement Cartridge/i],
  ["MSR", /TrailShot .* Cartridge & Maintenance Kit/i],
  ["MSR", /MiniWorks.* Maintenance Kit/i],
  ["Platypus", /GravityWorks.{0,3} Carbon Element/i],
  ["Platypus", /GravityWorks.{0,3} Replacement Filter/i],
  ["MSR", /HyperFlow.* Cartridge Replacement/i],
  ["Platypus", /Big Zip.* Connector Kit/i],
  ["Platypus", /QuickDraw.* Replacement .*Reservoir/i],
  ["Platypus", /GravityWorks.{0,3} Replacement Reservoirs/i],
  ["MSR", /AutoFlow.* Replacement .*Reservoir/i],
  ["Zenbivy", /Bivy Mug Lid Replacement/i],
  ["Vargo", /MUG REPLACEMENT LID/i],
  ["Zpacks", /Spare Gaiter Cord/i],
  ["Gossamer Gear", /Replacement Hiking Pole Tips/i],
  ["Neve Gear", /Waratah Spare Pad Strap Set/i],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  const GlobalItem = require("../models/globalItem");
  const GearItem = require("../models/gearItem");

  console.log("== ARCHIVE ACCESSORY JUNK ==");
  let archived = 0;
  for (const [brand, re] of JUNK) {
    const it = await C.findOne({ brand, name: re, isActive: true }).select("name brand").lean();
    if (!it) { console.log(`  !! not found: ${brand} ${re}`); continue; }
    const refs = (await GlobalItem.countDocuments({ productId: it._id })) + (await GearItem.countDocuments({ productId: it._id }));
    console.log(`  archive: ${it.brand}: ${it.name.slice(0, 52)}${refs ? `  (${refs} refs — snapshot keeps working)` : ""}`);
    archived++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { isActive: false } });
  }

  console.log("\n== ADD standard Nemo Moonlite ==");
  const name = "Moonlite™ Reclining Camp Chair", brand = "Nemo";
  const exists = await C.findOne({ name, brand, isActive: true }).select("_id").lean();
  if (exists) console.log("  ~~ exists — skip");
  else {
    const { category, subcategory } = categoryForItemType("Camp Chair", "");
    console.log(`  + ${brand} ${name} — 907g [${category}/${subcategory}]`);
    if (COMMIT) {
      const doc = new C({
        name, brand, itemType: "Camp Chair", category, subcategory,
        description: "Reclining camp chair with an adjustable, near-flat recline and a supportive suspension seat. Packed weight about 2 lb (907 g); supports up to 300 lb (136 kg). The lighter Moonlite Elite is 1.2 lb.",
        imageUrls: ["https://cdn.shopify.com/s/files/1/0582/1136/9133/files/suaofi3uquzngws46087.jpg", "https://cdn.shopify.com/s/files/1/0582/1136/9133/files/m99xolsmapguewltjmgh.jpg"],
        createdBy: ADMIN_ID, isActive: true, weightGrams: 907, attributes: { type: "Chair", maxLoadKg: 136 },
      });
      doc.$locals.lenientAttributes = true;
      await doc.save();
      await O.create({ network: "direct", region: "global", merchantId: "direct-nemo", merchantName: "Nemo", productId: doc._id, deepLink: "https://www.nemoequipment.com/products/moonlite-reclining-camp-chair", priority: 0 });
    }
  }

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${archived}/16`);
  await mongoose.disconnect();
})();
