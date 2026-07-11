/**
 * fix-review-weights.js — point weight fixes + footwear pair-weight normalization from the
 * 2026-07-10 adversarial review (server/reports/catalog-review-2026-07-10.md).
 * - Point fixes verified against brand PDPs (Vargo, Flextail, Arc'teryx via FF oz figure).
 * - Nulls where no trustworthy source exists (GramXpert eLite table not published in feed;
 *   Dandee publishes no weights; Patagonia Capilene trio rests on a copy-pasted corrupt figure).
 * - Footwear DECISION 2026-07-10 (user): pair weight across the board. Altra (36 weighted,
 *   stored per-single-shoe by design) and Salewa Crow GTX are doubled; the already-pair brands
 *   (Hoka/La Sportiva/Salomon/Brooks/Topo/Saucony/Kiprun) just get the disclosure line.
 *   Quechua/Simond/Forclaz footwear left untouched (Decathlon convention unverified — check on
 *   the next store-photo pass). updateOne only.
 *
 *   node src/scripts/fix-review-weights.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

// [brand, exact name, new weightGrams (null = blank), evidence]
const POINT_FIXES = [
  ["Flextail", "ZERO PUMP", 34, "flextail.com spec 1.2 oz (33±1 g); parser grabbed the ±1"],
  ["Flextail", "EVO REPELLER", 495, "flextail.com spec 17.28 oz (495±10 g); parser grabbed the ±10"],
  ["Vargo", "DECAGON ALCOHOL STOVE", 34, "vargooutdoors PDP: Weight 1.2 ounces (34 grams); was 5"],
  ["Vargo", "EXOTI ULTRA 40 BACKPACK", 1130, "vargooutdoors PDP: Total Weight 2lbs 8oz (1.13 kg); was 1361"],
  ["Vargo", "EXOTI - BYOB", 820, "vargooutdoors PDP: 1 lbs 13 oz (0.82 kg); was 1361"],
  ["Vargo", "UltraFly 1 Tent", 726, "vargooutdoors PDP: Minimum Weight 1lb 9oz (726g); was 907"],
  ["Vargo", "STAINLESS INSULATED 650 ML PARA-BOTTLE", 332, "vargooutdoors PDP: 11.7 oz / 332 g; was 454"],
  ["Arc'teryx", "Venta Glove", 65, "FF page pair '2.3 oz (663 g)' impossible; 2.3 oz = 65 g matches Arc'teryx spec"],
  ["GramXpert", "eLite quilt", null, "2 g came from 'Add 2g for 70cm zipper'; real per-size table not in feed"],
  ["GramXpert", "eLite quilt 7D/10D", null, "same 2 g artifact"],
  ["Dandee Packs", "Lightweight Poncho", null, "Dandee publishes no weights (QA policy: blank ok); 59 g looks invented"],
  ["Patagonia", "Capilene Midweight Crewneck Women's", null, "FF copy-pasted '4.3 oz (147 g)' on 3 garments; inconsistent"],
  ["Patagonia", "Capilene® Midweight Zip-Neck Pullover Women's", null, "same corrupt source"],
  ["Patagonia", "Capilene Midweight Bottoms Men's", null, "same corrupt source"],
];

const PAIR_NOTE = "Listed weight is per pair.";
const FOOTWEAR_TYPES = ["Trail Running Shoes", "Hiking Boots", "Hiking Shoes"];
const ALREADY_PAIR_BRANDS = ["Hoka", "La Sportiva", "Salomon", "Brooks", "Topo Athletic", "Saucony", "Kiprun"];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  console.log("== POINT FIXES ==");
  for (const [brand, name, w, why] of POINT_FIXES) {
    const it = await C.findOne({ brand, name, isActive: true }).select("weightGrams").lean();
    if (!it) { console.log(`  !! not found: ${brand}: ${name}`); continue; }
    console.log(`  ${brand}: ${name}  ${it.weightGrams}g -> ${w ?? "null"}   (${why})`);
    if (COMMIT) {
      const op = w == null ? { $unset: { weightGrams: 1 } } : { $set: { weightGrams: w } };
      await C.collection.updateOne({ _id: it._id }, op);
    }
  }

  console.log("\n== FOOTWEAR -> PAIR WEIGHT ==");
  // 1. Altra: stored per single shoe (by design, disclosed) -> double + fix disclosure text
  const altra = await C.find({ brand: "Altra", isActive: true, weightGrams: { $ne: null }, itemType: { $in: FOOTWEAR_TYPES } }).select("name weightGrams description").lean();
  for (const it of altra) {
    const nw = it.weightGrams * 2;
    const nd = (it.description || "").replace(/Listed weight is per single shoe at a manufacturer sample size; actual weight varies by size\./, "Listed weight is per pair at a manufacturer sample size; actual weight varies by size.");
    console.log(`  Altra ${it.name.slice(0, 48)}: ${it.weightGrams} -> ${nw}g`);
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { weightGrams: nw, description: nd } });
  }
  // 2. Salewa Crow GTX: 675 g is the published half-pair weight
  const salewa = await C.findOne({ brand: "Salewa", name: "Crow GORE-TEX", isActive: true }).select("name weightGrams description").lean();
  if (salewa) {
    console.log(`  Salewa ${salewa.name}: ${salewa.weightGrams} -> ${salewa.weightGrams * 2}g`);
    if (COMMIT) await C.collection.updateOne({ _id: salewa._id }, { $set: { weightGrams: salewa.weightGrams * 2, description: ((salewa.description || "") + "\n\n" + PAIR_NOTE).trim() } });
  }
  // 3. already-pair brands: stamp the disclosure if absent
  const pairBrands = await C.find({ brand: { $in: ALREADY_PAIR_BRANDS }, isActive: true, weightGrams: { $ne: null }, itemType: { $in: FOOTWEAR_TYPES } }).select("name brand description").lean();
  let stamped = 0;
  for (const it of pairBrands) {
    if (/per pair|per single/i.test(it.description || "")) continue;
    stamped++;
    if (COMMIT) await C.collection.updateOne({ _id: it._id }, { $set: { description: ((it.description || "") + "\n\n" + PAIR_NOTE).trim() } });
  }
  console.log(`  disclosure stamped on ${stamped} already-pair items (${ALREADY_PAIR_BRANDS.join(", ")})`);
  console.log(`  (Quechua/Simond/Forclaz footwear untouched — Decathlon convention unverified)`);

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
