/**
 * curate-vargo.js — post-ingest cleanup for Vargo (titanium gear, Shopify).
 * (1) archive clear noise (replacement parts, O-rings/lids/hangers, carabiners,
 *     whistles, lighter, wallet/money-clip, windscreen, cozies, car-camping grills
 *     + MEGAHEX fire pit); (2) fix AI mistypes (Sobata + Fire Box are STOVES, were
 *     typed Pocket Knife/Other); (3) backfill category/subcategory (not auto-derived
 *     on save). Does NOT touch apparel or weights — those are reported for a decision.
 *
 *   node src/scripts/curate-vargo.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}

// exact names to archive (noise / parts / pure-accessories / car-camping)
const ARCHIVE = [
  "SILICONE REPLACEMENT FUNNEL", "TITANIUM BOT HANGER", "Titanium BOT Hanger 2",
  "PARA / EDC O-RING", "650 TITANIUM REPLACEMENT LID", "EDC REPLACEMENT LID",
  "Plastic 650 ml bottle replacement lids", "HEXAGON BASE PLATE", "UTILITI REPLACEMENT BLADES",
  "BOT XL O-RING", "BOT O-RING", "FLIP COZY SILICONE RING", "FLINT REPLACEMENT KIT",
  "REPLACEMENT FERRO ROD", "ALUMINUM WINDSCREEN", "750 ML MUG REPLACEMENT LID",
  "BACKCOUNTRY CARABINER", "BINARY CARABINER", "TITANIUM EMERGENCY WHISTLE",
  "TITANIUM EMERGENCY WHISTLE WITH CLIP", "TITANIUM FLINT LIGHTER", "TITANIUM MONEY CLIP",
  "TITANIUM HINGE WALLET", "MEGAHEX Smokeless Fire Pit",
  "Ti Para-Bottle or EDC Cozy", "BOT COZY", "FLIP COZY",
  "TITANIUM FIRE BOX GRILL 2.0", "FIRE BOX GRILL - Stainless Steel", "TITANIUM BIFOLD GRILL",
];

// AI mistypes → correct type (Vargo Sobata / Fire Box are wood/multi-fuel stoves)
const RETYPE = {
  "Sobata-815": "Backpacking Stove (Canister)",
  "Sobata-799": "Backpacking Stove (Canister)",
  "SOBATA-398": "Backpacking Stove (Canister)",
  "TITANIUM FIRE BOX": "Backpacking Stove (Canister)",
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let archived = 0, retyped = 0, catFixed = 0;

  // 1) archive
  for (const name of ARCHIVE) {
    const d = await C.findOne({ name, brand: /vargo/i, isActive: true });
    if (!d) { console.log(`  ! archive: "${name}" not found/active`); continue; }
    console.log(`archive  ${name}`);
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { isActive: false } }); archived++; }
  }

  // 2) retype mistypes
  for (const [name, itemType] of Object.entries(RETYPE)) {
    const d = await C.findOne({ name, brand: /vargo/i, isActive: true });
    if (!d) { console.log(`  ! retype: "${name}" not found`); continue; }
    console.log(`retype   ${name.padEnd(28)} ${d.itemType} → ${itemType}`);
    if (COMMIT) {
      const { category, subcategory } = categoryForItemType(itemType, name);
      await C.updateOne({ _id: d._id }, { $set: { itemType, category, subcategory } });
      retyped++;
    }
  }

  // 3) backfill category on active typed items lacking one
  const needCat = await C.find({ brand: /vargo/i, isActive: true, itemType: { $ne: null }, $or: [{ category: null }, { category: { $exists: false } }] }).select("name itemType").lean();
  for (const d of needCat) {
    const { category, subcategory } = categoryForItemType(d.itemType, d.name);
    if (!category) { console.log(`  ! no category map for ${d.itemType} (${d.name})`); continue; }
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { category, subcategory } }); catFixed++; }
  }
  console.log(`\ncategory backfill: ${needCat.length} items need it`);

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${COMMIT ? archived : ARCHIVE.length}, retyped ${COMMIT ? retyped : Object.keys(RETYPE).length}, category ${COMMIT ? catFixed : needCat.length}`);
  await mongoose.disconnect();
})();
