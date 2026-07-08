/**
 * curate-gossamer.js — post-ingest cleanup for Gossamer Gear (Shopify).
 * (1) dedupe: archive the 3 pre-existing MANUAL packs (Gorilla 50 / Mariposa 60 /
 *     Mirage 40, no itemGroupId) — the feed versions (with variants) supersede;
 * (2) archive 7 resold third-party items (Toaks/DAC/Nitecore — mislabeled "Gossamer
 *     Gear") + the duplicate Kula Cloth (already a standalone item);
 * (3) archive "Other" noise (parts/bundles/accessories/stickers/resold care);
 * (4) backfill categories. Keeps GG-made packs/tents/dry bags/hip packs.
 *
 *   node src/scripts/curate-gossamer.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { categoryForItemType } = require("../config/inferItemType");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// resold third-party (mislabeled as Gossamer Gear) — archive
const RESOLD = [
  "DAC Mini J-Stakes", "Toaks Titanium 750ml Pot", "TOAKS Titanium Backpacking Stove",
  "Nitecore NU20 Classic Ultralight Headlamp",
  "Nitecore TIKI 300 Lumen USB-C Rechargeable Keychain Flashlight",
  "TOAKS Titanium Long Handle Spork with Polished Bowl", "Toaks Titanium V-shaped Peg",
  "Kula Cloth", // already a standalone catalog item
  "Gorilla Starter Kit", "Mariposa Starter Kit", // bundles
];
// pre-existing manual packs (no itemGroupId) that dup the feed variant versions
// ("Gorilla 50 Ultralight Backpack" etc.) — archive the manual one.
const MANUAL_DUP = ["Gorilla 50", "Mariposa 60", "Mirage 40"];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  let arch = 0, catFixed = 0;

  // 1) dedupe manual packs — archive the no-itemGroupId doc (feed variant version supersedes)
  for (const name of MANUAL_DUP) {
    const manual = await C.findOne({ name, brand: /gossamer/i, isActive: true, itemGroupId: { $in: [null, undefined] } });
    if (manual) { console.log(`dedupe   ${name} (archive manual, keep feed variant version)`); if (COMMIT) { await C.updateOne({ _id: manual._id }, { $set: { isActive: false } }); arch++; } }
    else console.log(`  ~ ${name}: no manual doc — skip`);
  }

  // 2) resold + dup Kula
  for (const name of RESOLD) {
    const d = await C.findOne({ name, brand: /gossamer/i, isActive: true });
    if (!d) { console.log(`  ! resold "${name}" not found`); continue; }
    console.log(`resold   ${name}`);
    if (COMMIT) { await C.updateOne({ _id: d._id }, { $set: { isActive: false } }); arch++; }
  }

  // 3) archive "Other" noise
  const others = await C.find({ brand: /gossamer/i, isActive: true, itemType: "Other" }).select("_id").lean();
  console.log(`\narchive ${others.length} "Other" (parts/bundles/accessories/resold care)`);
  if (COMMIT && others.length) { await C.updateMany({ _id: { $in: others.map((o) => o._id) } }, { $set: { isActive: false } }); arch += others.length; }

  // 4) backfill categories
  const needCat = await C.find({ brand: /gossamer/i, isActive: true, itemType: { $nin: [null, "Other"] }, $or: [{ category: null }, { category: { $exists: false } }] }).select("name itemType").lean();
  for (const d of needCat) { const { category, subcategory } = categoryForItemType(d.itemType, d.name); if (category && COMMIT) { await C.updateOne({ _id: d._id }, { $set: { category, subcategory } }); catFixed++; } }
  console.log(`category backfill: ${needCat.length} need it`);

  const active = await C.countDocuments({ brand: /gossamer/i, isActive: true });
  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: archived ${arch}, category ${catFixed} | active after: ${COMMIT ? active : active - arch}`);
  await mongoose.disconnect();
})();
