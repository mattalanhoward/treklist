/**
 * fix-nashville-weights.js — real weights from nashvillepack.com/pages/pack-specs.
 * The Cutaway: weight varies by Fabric × Volume (was a flat 255 placeholder).
 * Rebuild as Fabric(6) × Volume(3) = 18 variants with per-combo weight (mid/18"
 * torso, pack-body-only, oz→g) + per-variant mainFabric/volumeLiters. The Tiempo:
 * single, 165 g, 100D Robic Nylon, 15 L (was 198).
 *
 *   node src/scripts/fix-nashville-weights.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const FABRICS = ["ALUULA Graflyte V98", "Ultra 100X", "Ultra 200X", "UltraGrid", "Venom Gridstop ECO", "EPX200"];
const VOLS = ["20L", "30L", "40L"];
// grams at the middle (18") torso, pack body only
const W = {
  "ALUULA Graflyte V98": { "20L": 218, "30L": 247, "40L": 266 },
  "Ultra 100X":          { "20L": 241, "30L": 272, "40L": 300 },
  "Ultra 200X":          { "20L": 255, "30L": 286, "40L": 318 },
  "UltraGrid":           { "20L": 264, "30L": 295, "40L": 329 },
  "Venom Gridstop ECO":  { "20L": 261, "30L": 295, "40L": 323 },
  "EPX200":              { "20L": 306, "30L": 366, "40L": 411 },
};
const DEF = "ALUULA Graflyte V98 / 30L";

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  const cut = await C.findOne({ name: "The Cutaway", isActive: true, itemGroupId: /^nashvillepack-/ });
  if (cut) {
    const variants = [];
    for (const f of FABRICS) for (const v of VOLS)
      variants.push({ key: `${f} / ${v}`, options: { Fabric: f, Volume: v }, weightGrams: W[f][v], attributes: { mainFabric: f, volumeLiters: +v.replace("L", "") } });
    cut.variantAxes = [{ name: "Fabric", values: FABRICS }, { name: "Volume", values: VOLS }];
    cut.variants = variants;
    cut.defaultVariantKey = DEF;
    cut.weightGrams = W["ALUULA Graflyte V98"]["30L"]; // 247
    cut.attributes = { ...cut.attributes, mainFabric: "ALUULA Graflyte V98", volumeLiters: 30 };
    cut.description = "Our flagship pack — a commitment to building the best frameless ultralight pack on the market, with unrivaled comfort and accessibility. Available in 20/30/40 L and six fabrics (ALUULA Graflyte, Ultra 100X, Ultra 200X, UltraGrid, Venom Gridstop ECO, EPX200). Note: listed weights are for an 18\" torso (pack body only) and are approximate — packs are handmade.";
    cut.$locals.lenientAttributes = true;
    if (COMMIT) await cut.save();
    console.log(`The Cutaway -> ${variants.length} variants (Fabric×Volume), ${variants[0].weightGrams}–${Math.max(...variants.map(v => v.weightGrams))}g, default ${DEF}=${cut.weightGrams}g`);
  } else console.log("!! Cutaway not found");

  // The Cutaway Liner — Size (20/30/40 L, matches the pack) × Fabric. Only the 30L
  // weight is published (1.0 DCF 1.4oz/40g, D50T 2.8oz/79g) → weight is fabric-driven.
  const liner = await C.findOne({ name: "The Cutaway Liner", isActive: true, itemGroupId: /^nashvillepack-/ });
  if (liner) {
    const sizes = ["20L", "30L", "40L"];
    const fab = { "1.0 oz DCF": { w: 40, m: "1.0 oz Dyneema Composite Fabric" }, "D50T": { w: 79, m: "D50T waterproof laminate" } };
    const variants = [];
    for (const s of sizes) for (const [f, info] of Object.entries(fab))
      variants.push({ key: `${s} / ${f}`, options: { Size: s, Fabric: f }, weightGrams: info.w, attributes: { material: info.m, volumeLiters: +s.replace("L", "") } });
    liner.variantAxes = [{ name: "Size", values: sizes }, { name: "Fabric", values: Object.keys(fab) }];
    liner.variants = variants;
    liner.defaultVariantKey = "30L / 1.0 oz DCF";
    liner.weightGrams = 40;
    liner.attributes = { material: "1.0 oz Dyneema Composite Fabric", closureType: "Roll-Top" };
    liner.description = "The Cutaway Liner — ultralight, fully-taped waterproof roll-top drybag shaped to the Cutaway. In 20/30/40 L and 1.0 DCF or D50T. (Published weight is for the 30 L: 1.0 DCF ≈40 g, D50T ≈79 g.)";
    liner.$locals.lenientAttributes = true;
    if (COMMIT) await liner.save();
    console.log(`The Cutaway Liner -> Size×Fabric (${variants.length}v)`);
  } else console.log("!! Cutaway Liner not found");

  const tiempo = await C.findOne({ name: "The Tiempo 15", isActive: true, itemGroupId: /^nashvillepack-/ });
  if (tiempo) {
    tiempo.weightGrams = 165;
    tiempo.attributes = { ...tiempo.attributes, volumeLiters: 15 };
    tiempo.$locals.lenientAttributes = true;
    if (COMMIT) await tiempo.save();
    console.log(`The Tiempo 15 -> 165g, 15L (100D Robic Nylon)`);
  } else console.log("!! Tiempo not found");

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
