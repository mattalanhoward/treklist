/**
 * fix-review-decisions.js — user decisions on the 2026-07-10 review's open items
 * (answered 2026-07-11):
 * 1. Zenbivy ZipBed twins: archive BOTH generations (car camping) — 4 items.
 * 5. Cull car-camping/lifestyle: S2S Detour + Passage lines (Frontier = UL line, KEPT),
 *    BD logo hoodies x2, Big Agnes Guard Station 8, Nemo Jazz double bags.
 * Archived = isActive:false (restorable); refs keep working via denormalized snapshots.
 *
 *   node src/scripts/fix-review-decisions.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const GlobalItem = require("../models/globalItem");
  const GearItem = require("../models/gearItem");
  let archived = 0;
  const archive = async (it, why) => {
    const refs = (await GlobalItem.countDocuments({ productId: it._id })) + (await GearItem.countDocuments({ productId: it._id }));
    console.log(`  archive [${why}] ${it.brand}: ${it.name.slice(0, 62)}${refs ? `  (${refs} refs — snapshot keeps working)` : ""}`);
    archived++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { isActive: false } });
  };

  // 1. Zenbivy ZipBed twins (both generations)
  const zb = await C.find({ brand: "Zenbivy", isActive: true, name: /^(Overland ZipBed|ZipBed Overland) \d+°F/i }).select("name brand").lean();
  for (const it of zb) await archive(it, "zenbivy-zipbed");

  // 5. S2S Detour + Passage (stainless car-camping dinnerware; Frontier stays)
  const s2s = await C.find({ brand: "Sea to Summit", isActive: true, name: /^(Detour|Passage)\b/i }).select("name brand").lean();
  for (const it of s2s) await archive(it, "s2s-carcamp");

  // 5. BD logo hoodies
  for (const name of ["Men's Mini Stacked Crewneck", "Women's Heritage Wordmark Pullover Hoody"]) {
    const it = await C.findOne({ brand: "Black Diamond", name, isActive: true }).select("name brand").lean();
    if (it) await archive(it, "bd-logo");
    else console.log("  !! not found: " + name);
  }

  // 5. basecamp/car-camping outliers
  const ga = await C.findOne({ brand: "Big Agnes", name: /Guard Station 8/i, isActive: true }).select("name brand").lean();
  if (ga) await archive(ga, "basecamp");
  const jazz = await C.find({ brand: "Nemo", name: /jazz/i, isActive: true }).select("name brand").lean();
  for (const it of jazz) await archive(it, "car-camping");

  // 4. Simond kids' climbing harnesses (user 2026-07-11: archive)
  const kids = await C.find({ brand: "Simond", isActive: true, name: /kid['’]?s .*(harness|climbing)/i }).select("name brand").lean();
  for (const it of kids) await archive(it, "kids");

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}: ${archived} archived`);
  await mongoose.disconnect();
})();
