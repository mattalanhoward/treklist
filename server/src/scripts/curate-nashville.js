/**
 * curate-nashville.js — deep-curate the 5 kept Nashville Pack items.
 * The Cutaway: Fabric × Volume variants (per-variant fabric+volume; no per-combo
 * weight published, so base weight + user override). Tiempo single. Liners: DCF/
 * D50T fabric variants with weights. Groundsheet: material. Descriptions trimmed.
 * "Supply Your Own Fabric" excluded (already archived).
 *
 *   node src/scripts/curate-nashville.js [--commit]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") { console.error("local only"); process.exit(1); }

const byName = async (C, name) => C.findOne({ name, isActive: true, itemGroupId: /^nashvillepack-/ });

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");

  // The Cutaway — Fabric x Volume
  let d = await byName(C, "The Cutaway 20 | 30 | 40");
  if (d) {
    const fabrics = ["Aluula Graflyte", "Venom Gridstop ECO"], vols = ["20L", "30L", "40L"];
    const variants = [];
    for (const f of fabrics) for (const v of vols)
      variants.push({ key: `${f} / ${v}`, options: { Fabric: f, Volume: v }, attributes: { mainFabric: f, volumeLiters: +v.replace("L", "") } });
    d.name = "The Cutaway";
    d.variantAxes = [{ name: "Fabric", values: fabrics }, { name: "Volume", values: vols }];
    d.variants = variants;
    d.defaultVariantKey = "Aluula Graflyte / 30L";
    d.weightGrams = 255; // representative (Aluula 30L); per-combo weights not published
    d.attributes = { volumeLiters: 30, gender: "Unisex", frameType: "Frameless", hipBeltType: "Padded", hipBeltRemovable: true, waterResistance: "Water Resistant", mainFabric: "Aluula Graflyte", torsoFitRange: "16–20 in (41–51 cm)" };
    d.description = "Our flagship pack — a commitment to building the best frameless ultralight pack on the market, with unrivaled comfort and accessibility. Available in Aluula Graflyte or Venom Gridstop ECO, in 20/30/40 L.";
    d.$locals.lenientAttributes = true;
    if (COMMIT) await d.save();
    console.log("The Cutaway -> Fabric×Volume (6v), base 255g");
  } else console.log("!! Cutaway");

  // The Tiempo 15 — 15L < Backpack min 20 -> Daypack (no mainFabric field on Daypack)
  d = await byName(C, "The Tiempo 15");
  if (d) {
    const { categoryForItemType } = require("../config/inferItemType");
    d.itemType = "Daypack";
    const { category, subcategory } = categoryForItemType("Daypack", d.name);
    if (category) d.category = category; if (subcategory) d.subcategory = subcategory;
    d.weightGrams = 198;
    d.attributes = { volumeLiters: 15, gender: "Unisex", frameType: "Frameless", hipBeltType: "None", waterResistance: "Water Resistant" };
    d.description = "A small pack with big-time comfort. The Tiempo keeps our signature accessibility and comfort for those moving fast with small loads.";
    d.$locals.lenientAttributes = true;
    if (COMMIT) await d.save();
    console.log("The Tiempo 15 -> Daypack 15L, 198g");
  } else console.log("!! Tiempo");

  // Liners (Pack Liner) — DCF / D50T fabric variants
  const liners = [
    { name: "The Cutaway Liner", dcf: 40, d50t: 79, blurb: "The Cutaway Liner — ultralight, durable, waterproof, and shaped to the Cutaway's geometry to keep your gear dry." },
    { name: "The Tiempo Liner", dcf: 40, d50t: 65, blurb: "The Tiempo Liner — ultralight waterproof drybag shaped to the Tiempo to keep your gear dry and secure." },
  ];
  for (const L of liners) {
    d = await byName(C, L.name);
    if (!d) { console.log("!! " + L.name); continue; }
    d.variantAxes = [{ name: "Fabric", values: ["1.0 oz DCF", "D50T"] }];
    d.variants = [
      { key: "1.0 oz DCF", options: { Fabric: "1.0 oz DCF" }, weightGrams: L.dcf, attributes: { material: "1.0 oz Dyneema Composite Fabric" } },
      { key: "D50T", options: { Fabric: "D50T" }, weightGrams: L.d50t, attributes: { material: "D50T waterproof laminate" } },
    ];
    d.defaultVariantKey = "1.0 oz DCF";
    d.weightGrams = L.dcf;
    d.attributes = { material: "1.0 oz Dyneema Composite Fabric", closureType: "Roll-Top" };
    d.description = L.blurb;
    d.$locals.lenientAttributes = true;
    if (COMMIT) await d.save();
    console.log(`${L.name} -> Fabric[DCF ${L.dcf}g / D50T ${L.d50t}g]`);
  }

  // DCF Groundsheet
  d = await byName(C, "DCF Groundsheet");
  if (d) {
    d.attributes = { material: "Cuben/DCF" };
    d.description = "A 1.0 oz/yd² Dyneema Composite Fabric groundsheet — puncture- and abrasion-resistant protection for cowboy camping or under your tent. Multiple sizes.";
    d.$locals.lenientAttributes = true;
    if (COMMIT) await d.save();
    console.log("DCF Groundsheet -> Cuben/DCF");
  } else console.log("!! Groundsheet");

  console.log(`\n${COMMIT ? "APPLIED" : "DRY-RUN"}`);
  await mongoose.disconnect();
})();
